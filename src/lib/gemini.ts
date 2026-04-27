import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Delivery, Course, AreaRule, VehicleSpec,
  AssignmentLogEntry, CapacityWarning,
} from "@/shared/types/delivery";
import { dbscan } from "@/lib/clustering";
import { getTruckThreshold, checkCapacity } from "@/lib/capacity";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export type AssignmentResult = {
  deliveryId: string;
  courseId: string | null;
  reason: string;
  unassignedReason: string;
};

export type AutoAssignOutput = {
  assignments: AssignmentResult[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  imageRulesText: string | null;
};

function readNumericEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    console.warn(`[gemini] ${name}="${raw}" is not a number, falling back to ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

const EPS_KM = readNumericEnv("DBSCAN_EPS_KM", 5);
const MIN_PTS = readNumericEnv("DBSCAN_MIN_PTS", 2);

function appendLog(log: AssignmentLogEntry[], step: number, title: string, message: string): void {
  log.push({ step, title, message, timestamp: Date.now() });
}

async function extractAreaRulesFromImage(areaImage: string, courses: Course[]): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
  const base64Data = areaImage.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = areaImage.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
  const courseList = courses.map((c) => `${c.name}（${c.vehicleType === "2t" ? "2tトラック" : "軽自動車"}）`).join(", ");
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: `この画像は配送エリアの区割り図です。色分けされたエリアをテキストで説明してください。

利用可能なコース: ${courseList}

以下の形式で各エリアがどの市区町村を含むか具体的に記述してください:
- コース名: 含まれる市区町村の一覧と方角の特徴

テキストのみ出力してください。` },
    ]);
    return result.response.text();
  } catch (error) {
    console.error("[gemini] Image analysis error:", error);
    return "";
  }
}

type AssignBatchInput = {
  deliveries: Delivery[];
  candidateCourses: Course[];
  vehicleType: "light" | "2t";
  vehicleSpec: VehicleSpec;
  threshold: number;
  areaRules: AreaRule[];
  areaDescription: string;
  clusterMap: Map<string, number>;
};

async function callAssignBatch(input: AssignBatchInput): Promise<AssignmentResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  const { deliveries, candidateCourses, vehicleType, vehicleSpec, threshold, areaRules, areaDescription, clusterMap } = input;
  const validIds = new Set(candidateCourses.map((c) => c.id));
  const courseDescriptions = candidateCourses
    .map((c) => `- ${c.id} (${c.name}): 担当エリア「${c.defaultRegion || "未設定"}」`)
    .join("\n");
  const rulesText = areaRules.length > 0
    ? "\n【エリアルール】\n" + areaRules.map((r) => `- ${r.region} → ${r.courseId}`).join("\n")
    : "";
  const items = deliveries.map((d) => ({
    id: d.id,
    address: d.address,
    volume: d.volume,
    weight: d.actualWeight,
    lat: d.lat,
    lng: d.lng,
    clusterId: clusterMap.get(d.id) ?? -1,
  }));
  const prompt = `あなたは配送ルート振り分けの専門家です。以下の${vehicleType === "2t" ? `大口（容積${threshold}L以上）` : "通常"}荷物を、稼働中の${vehicleType === "2t" ? "2tコース" : "軽コース"}に割り当ててください。

【稼働中のコース】
${courseDescriptions}

【車両スペック】
${vehicleType === "2t" ? "2tトラック" : "軽自動車"}: 1台あたり容積上限 ${vehicleSpec.maxVolume}L、重量上限 ${vehicleSpec.maxWeight}kg、件数上限 ${vehicleSpec.maxOrders}件
${areaDescription ? `\n【エリア設定】\n${areaDescription}\n` : ""}${rulesText}

【判断手順】
1. 同じ clusterId の荷物は地理的に近接している。可能な限り同じコースに割り当てる
2. 各コースの容積/重量/件数の上限を超えないよう調整
3. エリアルールに該当しない、またはどのコースに振るべきか判断できない荷物は courseId="" で返し、unassignedReason に "<理由>" を書く

【荷物リスト】
${JSON.stringify(items)}

【出力形式】
{ "assignments": [{ "deliveryId": "...", "courseId": "...", "reason": "...", "unassignedReason": "" }] }
JSONのみ出力してください。`;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.assignments as Array<{ deliveryId: string; courseId: string; reason?: string; unassignedReason?: string }>).map((a) => {
      const matched = validIds.has(a.courseId) ? a.courseId : "";
      return {
        deliveryId: a.deliveryId,
        courseId: matched || null,
        reason: a.reason ?? "",
        unassignedReason: matched ? "" : (a.unassignedReason || "AIが判断できませんでした"),
      };
    });
  } catch (error) {
    console.error("[gemini] callAssignBatch error:", error);
    return deliveries.map((d) => ({
      deliveryId: d.id, courseId: null, reason: "", unassignedReason: "AI呼び出しに失敗しました",
    }));
  }
}

async function reviewGeoConsistency(
  assignments: AssignmentResult[],
  deliveries: Delivery[],
  courses: Course[],
  activeCourseIds: string[],
  areaDescription: string
): Promise<AssignmentResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  const assignMap = new Map(assignments.map((a) => [a.deliveryId, a.courseId]));
  const reviewData = deliveries
    .filter((d) => assignMap.get(d.id))
    .map((d) => ({ id: d.id, address: d.address, currentCourseId: assignMap.get(d.id) }));
  if (reviewData.length === 0) return assignments;
  const courseList = courses
    .filter((c) => activeCourseIds.includes(c.id))
    .map((c) => `${c.id} (${c.name})`).join(", ");
  const prompt = `あなたは配送ルートの品質レビュアーです。以下の振り分け結果を確認し、地理的に明らかに別エリアに属する配送先のみを修正してください。

【利用可能なコース】
${courseList}
${areaDescription ? `\n【エリアルール】\n${areaDescription}\n` : ""}
【レビュー対象】
${JSON.stringify(reviewData)}

【指示】
- 地理的に明らかに別エリアに属する配送先があれば、近隣コースに修正
- 修正不要なものはスキップ
- 未割り当て（courseId=null）はそのまま残す
- 容量超過の解消は対象外、地理整合性のみ判定

【出力形式】
{ "corrections": [{ "deliveryId": "...", "newCourseId": "...", "reason": "..." }] }
JSONのみ出力してください。`;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return assignments;
    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(activeCourseIds);
    const correctionMap = new Map<string, { courseId: string; reason: string }>();
    for (const c of (parsed.corrections as Array<{ deliveryId: string; newCourseId: string; reason?: string }>)) {
      if (validIds.has(c.newCourseId)) {
        correctionMap.set(c.deliveryId, { courseId: c.newCourseId, reason: c.reason ?? "" });
      }
    }
    return assignments.map((a) => {
      const fix = correctionMap.get(a.deliveryId);
      return fix
        ? { ...a, courseId: fix.courseId, reason: `${fix.reason}（レビューで修正）` }
        : a;
    });
  } catch (error) {
    console.error("[gemini] review error:", error);
    return assignments;
  }
}

const BATCH_SIZE = 100;

export async function autoAssign(
  deliveries: Delivery[],
  courses: Course[],
  activeCourseIds: string[],
  vehicleSpecs: VehicleSpec[],
  areaRules: AreaRule[],
  areaImages: string[],
  areaDescription: string,
  prefetchedImageRules: string | null = null
): Promise<AutoAssignOutput> {
  const log: AssignmentLogEntry[] = [];

  // 段階0: 画像→テキスト変換（キャッシュがあればスキップ）
  let effectiveDescription = areaDescription;
  let imageRulesText: string | null = null;
  if (prefetchedImageRules) {
    imageRulesText = prefetchedImageRules;
    effectiveDescription = effectiveDescription
      ? `${effectiveDescription}\n\n【画像から読み取ったエリアルール】\n${prefetchedImageRules}`
      : prefetchedImageRules;
    appendLog(log, 0, "画像ルール変換", `キャッシュから ${prefetchedImageRules.length} 文字のルールを使用`);
  } else if (areaImages.length > 0) {
    const t0 = Date.now();
    const perImage = await Promise.all(areaImages.map((img) => extractAreaRulesFromImage(img, courses)));
    const merged = perImage
      .map((text, i) => text ? `[画像${i + 1}]\n${text}` : "")
      .filter(Boolean)
      .join("\n\n");
    if (merged) {
      imageRulesText = merged;
      effectiveDescription = effectiveDescription
        ? `${effectiveDescription}\n\n【画像から読み取ったエリアルール】\n${merged}`
        : merged;
      appendLog(log, 0, "画像ルール変換", `${areaImages.length}枚の画像から ${merged.length} 文字のルールを抽出 (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
    }
  }

  // 段階1: 大口抽出
  const threshold = getTruckThreshold(vehicleSpecs);
  const geoOk = deliveries.filter((d) => d.lat !== null && d.lng !== null);
  const geoNg = deliveries.filter((d) => d.lat === null || d.lng === null);
  const truckCandidates = geoOk.filter((d) => d.volume >= threshold);
  const lightCandidates = geoOk.filter((d) => d.volume < threshold);
  appendLog(log, 1, "大口抽出", `閾値 ${threshold}L / 大口 ${truckCandidates.length}件、軽対象 ${lightCandidates.length}件、ジオコード失敗 ${geoNg.length}件`);

  // 段階2: クラスタリング
  const truckClusters = dbscan(
    truckCandidates.map((d) => ({ id: d.id, lat: d.lat!, lng: d.lng! })),
    { epsKm: EPS_KM, minPts: MIN_PTS }
  );
  const lightClusters = dbscan(
    lightCandidates.map((d) => ({ id: d.id, lat: d.lat!, lng: d.lng! })),
    { epsKm: EPS_KM, minPts: MIN_PTS }
  );
  const truckClusterCount = new Set(Array.from(truckClusters.values()).filter((v) => v >= 0)).size;
  const lightClusterCount = new Set(Array.from(lightClusters.values()).filter((v) => v >= 0)).size;
  const truckNoise = Array.from(truckClusters.values()).filter((v) => v === -1).length;
  const lightNoise = Array.from(lightClusters.values()).filter((v) => v === -1).length;
  appendLog(log, 2, "クラスタリング", `eps=${EPS_KM}km, minPts=${MIN_PTS} / 2t用 ${truckClusterCount}クラスタ(外れ値${truckNoise}), 軽用 ${lightClusterCount}クラスタ(外れ値${lightNoise})`);

  const truckCourses = courses.filter((c) => activeCourseIds.includes(c.id) && c.vehicleType === "2t");
  const lightCourses = courses.filter((c) => activeCourseIds.includes(c.id) && c.vehicleType === "light");
  const truckSpec = vehicleSpecs.find((s) => s.vehicleType === "2t") ?? null;
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light") ?? null;

  const allAssignments: AssignmentResult[] = [];

  // 段階3: 2t割り当て（1バッチ）
  if (truckCandidates.length > 0 && truckCourses.length > 0 && truckSpec) {
    const t0 = Date.now();
    const res = await callAssignBatch({
      deliveries: truckCandidates,
      candidateCourses: truckCourses,
      vehicleType: "2t",
      vehicleSpec: truckSpec,
      threshold,
      areaRules,
      areaDescription: effectiveDescription,
      clusterMap: truckClusters,
    });
    allAssignments.push(...res);
    const assigned = res.filter((r) => r.courseId).length;
    const unassigned = res.length - assigned;
    appendLog(log, 3, "2t割り当て", `${assigned}件割当 / ${unassigned}件未割当 (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
  } else if (truckCandidates.length > 0) {
    const reason = truckCourses.length === 0 ? "稼働中の2tコースなし" : "2t車両スペック未登録";
    truckCandidates.forEach((d) => allAssignments.push({
      deliveryId: d.id, courseId: null, reason: "", unassignedReason: reason,
    }));
    appendLog(log, 3, "2t割り当て", `${reason}のため ${truckCandidates.length}件すべて未割当`);
  }

  // 段階4: 軽割り当て（バッチ分割）
  if (lightCandidates.length > 0 && lightCourses.length > 0 && lightSpec) {
    const t0 = Date.now();
    let batches = 0;
    const lightBatchResults: AssignmentResult[] = [];
    for (let i = 0; i < lightCandidates.length; i += BATCH_SIZE) {
      const batch = lightCandidates.slice(i, i + BATCH_SIZE);
      const res = await callAssignBatch({
        deliveries: batch,
        candidateCourses: lightCourses,
        vehicleType: "light",
        vehicleSpec: lightSpec,
        threshold,
        areaRules,
        areaDescription: effectiveDescription,
        clusterMap: lightClusters,
      });
      lightBatchResults.push(...res);
      batches++;
    }
    allAssignments.push(...lightBatchResults);
    const assigned = lightBatchResults.filter((r) => r.courseId).length;
    const unassigned = lightBatchResults.length - assigned;
    appendLog(log, 4, "軽割り当て", `${assigned}件割当 / ${unassigned}件未割当 (${batches}バッチ, ${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
  } else if (lightCandidates.length > 0) {
    const reason = lightCourses.length === 0 ? "稼働中の軽コースなし" : "軽車両スペック未登録";
    lightCandidates.forEach((d) => allAssignments.push({
      deliveryId: d.id, courseId: null, reason: "", unassignedReason: reason,
    }));
    appendLog(log, 4, "軽割り当て", `${reason}のため ${lightCandidates.length}件すべて未割当`);
  }

  // ジオコード失敗を未割当として追加
  geoNg.forEach((d) => allAssignments.push({
    deliveryId: d.id, courseId: null, reason: "", unassignedReason: "ジオコーディング失敗",
  }));

  // 段階5: 容量チェック
  const warnings = checkCapacity(allAssignments, deliveries, courses, vehicleSpecs, activeCourseIds);
  appendLog(log, 5, "容量チェック", warnings.length === 0 ? "上限超過なし" : `警告 ${warnings.length}件: ${warnings.map((w) => w.message).join(", ")}`);

  // 段階6: 地理整合性レビュー
  const t0 = Date.now();
  const reviewed = await reviewGeoConsistency(allAssignments, deliveries, courses, activeCourseIds, effectiveDescription);
  const corrections = reviewed.filter((r, i) => r.courseId !== allAssignments[i].courseId).length;
  appendLog(log, 6, "地理整合性レビュー", `修正 ${corrections}件 (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);

  return { assignments: reviewed, assignmentLog: log, capacityWarnings: warnings, imageRulesText };
}
