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

  const rulesText = areaRules.length > 0
    ? areaRules.map((r) => `- ${r.region} → ${r.driverName}（${r.vehicleType}）`).join("\n")
    : "エリアルールは未設定です。住所の地域から適切に判断してください。";

  return `あなたは配送ルート振り分けの専門家です。
以下の配送先リストを、ドライバーに振り分けてください。

【ルール】
- 容積1,000L以上の荷物 → 2tトラックドライバーのみ: ${truckDrivers.map((d) => d.name).join(", ")}
- 容積1,000L未満の荷物 → 軽自動車ドライバーのみ: ${lightDrivers.map((d) => d.name).join(", ")}
- 同じ地域の配送先はできるだけ同じドライバーに振り分ける
- 各ドライバーの件数が均等になるよう配慮する

【エリアルール】
${rulesText}

【配送先リスト】
${JSON.stringify(deliveries.map((d) => ({ id: d.id, address: d.address, volume: d.volume, name: d.destinationName })))}

【出力形式】
以下のJSON形式で出力してください。他のテキストは含めないでください。
{ "assignments": [{ "deliveryId": "...", "driverName": "...", "reason": "..." }] }`;
}

export async function autoAssign(
  deliveries: Delivery[],
  drivers: Driver[],
  areaRules: AreaRule[]
): Promise<AssignmentResult[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
      const assignments: AssignmentResult[] = parsed.assignments.map(
        (a: AssignmentResult) => ({
          deliveryId: a.deliveryId,
          driverName: validDriverNames.has(a.driverName) ? a.driverName : "",
          reason: a.reason || "",
        })
      );
      allAssignments.push(...assignments);
    } catch {
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
