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

【神奈川県の配送エリア（軽自動車4コース）— 区割り図に基づく】
戸塚を起点に、以下のようにエリアを分割する。番号は区割り図の番号に対応：

- コース1（軽）: 横浜市東部エリア — 鶴見区、神奈川区、西区、中区、南区、磯子区、金沢区北部。川崎市南部（川崎区、幸区、中原区）も含む。戸塚から東〜北東方向。
- コース2（軽）: 横浜市南部〜湘南エリア — 港南区、栄区、金沢区南部、鎌倉市、逗子市、横須賀市、藤沢市東部。戸塚から南〜南東方向。
- コース3（軽）: 横浜市中央〜北部エリア — 戸塚区周辺、保土ケ谷区、旭区、緑区、港北区、都筑区、青葉区、川崎市北部（高津区、宮前区、多摩区、麻生区）。泉区北部も含む。戸塚から北方向。
- コース4（軽）: 西部・内陸エリア — 瀬谷区、泉区南部、大和市、座間市、海老名市、綾瀬市、厚木市、愛甲郡、相模原市、藤沢市西部、茅ヶ崎市、平塚市。戸塚から西〜北西方向。

【神奈川県の配送エリア（2tトラック）】
戸塚を起点に左右2分割：
- 2t-右: コース1・コース2のエリアに該当する配送先（横浜市東部〜南部、川崎市南部）
- 2t-左: コース3・コース4のエリアに該当する配送先（横浜市北部〜西部、内陸部）

【東京都下の配送エリア — 区割り図に基づく】
東京都下の配送先がある場合、地域に応じてコースに含める：
- 東側（青エリア）: 町田市、稲城市、多摩市、府中市、調布市、狛江市、三鷹市、武蔵野市 → コース1（軽）またはコース3（軽）に含める
- 中央（オレンジエリア）: 立川市、日野市、国分寺市、国立市、小金井市、小平市、東村山市、八王子市東部 → コース3（軽）またはコース4（軽）に含める
- 西側（緑エリア）: 八王子市西部、青梅市、福生市、あきる野市、羽村市、瑞穂町、昭島市、武蔵村山市 → コース4（軽）に含める
- 南西（黄エリア）: 相模原市に近い都下エリア → コース4（軽）に含める
件数が少ない場合は、地理的に近いコースにまとめて効率化してよい。

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
