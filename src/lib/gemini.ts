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
  areaRules: AreaRule[],
  areaDescription: string
): string {
  const lightDrivers = drivers.filter((d) => d.vehicleType === "light");
  const truckDrivers = drivers.filter((d) => d.vehicleType === "2t");

  const customRulesText = areaRules.length > 0
    ? "\n【カスタムエリアルール】\n" + areaRules.map((r) => `- ${r.region} → ${r.driverName}（${r.vehicleType}）`).join("\n")
    : "";

  const areaText = areaDescription
    ? `\n【エリア設定（テキスト）】\n${areaDescription}\n`
    : "";

  // If an image is also provided, it will be sent as multimodal content (handled in autoAssign)
  const imageNote = "（区割り画像が添付されている場合、その画像のエリア分けに従って振り分けてください）";

  return `あなたは配送ルート振り分けの専門家です。
以下の配送先リストを、ドライバーに振り分けてください。

【拠点】
横浜市戸塚区上矢部町の倉庫から全車出発。ドライバーは配送後に直帰。

【車両ルール】
- 容積1,000L以上の荷物 → 2tトラックのみ: ${truckDrivers.map((d) => d.name).join(", ")}
- 容積1,000L未満の荷物 → 軽自動車のみ: ${lightDrivers.map((d) => d.name).join(", ")}
${areaText}${customRulesText}
${!areaDescription && areaRules.length === 0 ? `
【エリア設定なし】
エリアルールが未設定です。配送先の住所の地理的分布を分析し、以下の原則に従って最適に振り分けてください：
- 地理的に近い配送先を同じドライバーにまとめる
- 各ドライバーの件数・容積がなるべく均等になるよう配慮する
- 一筆書きで効率よく回れるルートを意識する
` : ''}
${imageNote}

【振り分けの原則】
- 地理的に近い配送先を同じドライバーにまとめ、移動距離を最小化する
- 各ドライバーの件数・容積がなるべく均等になるよう配慮する
- 一筆書きで効率よく回れるルートを意識する

【配送先リスト】
${JSON.stringify(deliveries.map((d) => ({ id: d.id, address: d.address, volume: d.volume, name: d.destinationName })))}

【出力形式】
以下のJSON形式のみ出力してください。他のテキストは含めないでください。
{ "assignments": [{ "deliveryId": "...", "driverName": "...", "reason": "..." }] }`;
}

export async function autoAssign(
  deliveries: Delivery[],
  drivers: Driver[],
  areaRules: AreaRule[],
  areaImage: string | null,
  areaDescription: string
): Promise<AssignmentResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
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
      areaRules,
      areaDescription
    );

    try {
      let text: string;

      if (areaImage) {
        // Multimodal: send image + text
        const base64Data = areaImage.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = areaImage.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: "この画像はエリア区割り図です。この区割りに基づいて、以下の配送先をドライバーに振り分けてください。\n\n" + prompt },
        ]);
        text = result.response.text();
      } else {
        // Text only (existing flow)
        const result = await model.generateContent(prompt);
        text = result.response.text();
      }

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
