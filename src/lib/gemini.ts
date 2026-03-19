import { GoogleGenerativeAI } from "@google/generative-ai";
import { Delivery, Driver, AreaRule } from "@/shared/types/delivery";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type AssignmentResult = {
  deliveryId: string;
  driverName: string;
  reason: string;
};

function buildPrompt(
  deliveries: Pick<Delivery, "id" | "address" | "volume" | "destinationName">[],
  drivers: Driver[],
  areaRules: AreaRule[]
): string {
  const lightDrivers = drivers.filter((d) => d.vehicleType === "light");
  const truckDrivers = drivers.filter((d) => d.vehicleType === "2t");

  const customRulesText = areaRules.length > 0
    ? "\n【カスタムエリアルール（優先）】\n" + areaRules.map((r) => `- ${r.region} → ${r.driverName}（${r.vehicleType}）`).join("\n")
    : "";

  return `あなたは神奈川県・東京都の配送ルート振り分けの専門家です。
以下の配送先リストを、ドライバーに振り分けてください。

【拠点】
横浜市戸塚区上矢部町の倉庫から全車出発。ドライバーは配送後に直帰。

【車両ルール】
- 容積1,000L以上の荷物 → 2tトラックのみ: ${truckDrivers.map((d) => d.name).join(", ")}
- 容積1,000L未満の荷物 → 軽自動車のみ: ${lightDrivers.map((d) => d.name).join(", ")}

【神奈川県の配送エリア（軽自動車4コース）】
戸塚を起点に、以下のようにエリアを分割する：
- コース1（軽）: 横浜市南西部（戸塚区、泉区、瀬谷区）、藤沢市、茅ヶ崎市、平塚市方面 — 戸塚から西〜南西方向
- コース2（軽）: 横浜市南東部（港南区、磯子区、金沢区）、鎌倉市、逗子市、横須賀市方面 — 戸塚から南〜南東方向
- コース3（軽）: 横浜市北部（保土ケ谷区、旭区、緑区、青葉区、都筑区、港北区）、川崎市方面 — 戸塚から北〜北東方向
- コース4（軽）: 相模原市、厚木市、海老名市、座間市、大和市、愛甲郡方面 — 戸塚から北西方向

【神奈川県の配送エリア（2tトラック）】
戸塚を起点に左右2分割：
- 2t-右: 横浜市東部〜川崎市〜東京寄りのエリア
- 2t-左: 横浜市西部〜湘南〜相模方面

【東京都下の配送エリア】
東京都下の配送先がある場合、件数に応じて軽自動車1〜2台で対応。左右（東西）に分割：
- 西側（八王子、立川、青梅、福生、あきる野、日野、昭島、武蔵村山方面）
- 東側（府中、調布、多摩、稲城、町田、狛江、武蔵野、三鷹、小金井方面）
現在のドライバーリストから、件数が少なければコース3やコース4に含めて効率化してもよい。

【振り分けの原則】
- 地理的に近い配送先を同じドライバーにまとめ、移動距離を最小化する
- 各ドライバーの件数・容積がなるべく均等になるよう配慮する
- 一筆書きで効率よく回れるルートを意識する
${customRulesText}

【配送先リスト】
${JSON.stringify(deliveries.map((d) => ({ id: d.id, address: d.address, volume: d.volume, name: d.destinationName })))}

【出力形式】
以下のJSON形式のみ出力してください。他のテキストは含めないでください。
{ "assignments": [{ "deliveryId": "...", "driverName": "...", "reason": "..." }] }`;
}

export async function autoAssign(
  deliveries: Delivery[],
  drivers: Driver[],
  areaRules: AreaRule[]
): Promise<AssignmentResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const batchSize = 100;
  const allAssignments: AssignmentResult[] = [];
  const validDriverNames = new Set(drivers.map((d) => d.name));

  for (let i = 0; i < deliveries.length; i += batchSize) {
    const batch = deliveries.slice(i, i + batchSize);
    const prompt = buildPrompt(
      batch.map((d) => ({
        id: d.id,
        address: d.address,
        volume: d.volume,
        destinationName: d.destinationName,
      })),
      drivers,
      areaRules
    );

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = JSON.parse(jsonMatch[0]);
      const driverNameArray = Array.from(validDriverNames);
      const assignments: AssignmentResult[] = parsed.assignments.map(
        (a: AssignmentResult) => {
          let matched = "";
          if (validDriverNames.has(a.driverName)) {
            matched = a.driverName;
          } else {
            // 部分一致: Geminiが「コース1」と返しても「コース1（軽）」にマッチ
            const found = driverNameArray.find(
              (name) => name.includes(a.driverName) || a.driverName.includes(name)
            );
            if (found) matched = found;
          }
          if (!matched) {
            console.warn(`[gemini] Unknown driver name: "${a.driverName}"`);
          }
          return {
            deliveryId: a.deliveryId,
            driverName: matched,
            reason: a.reason || "",
          };
        }
      );
      allAssignments.push(...assignments);
    } catch (error) {
      console.error("[gemini] Auto-assign error:", error);
      batch.forEach((d) => {
        allAssignments.push({
          deliveryId: d.id,
          driverName: "",
          reason: "自動振り分けに失敗しました",
        });
      });
    }
  }

  return allAssignments;
}
