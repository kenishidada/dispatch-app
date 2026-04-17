import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseExcelFile } from "../useExcelParser";

describe("parseExcelFile (golden: totsuka-0417)", () => {
  it("aggregates 277 rows to 152 unique deliveries with expected totals", async () => {
    // Note: 277 rows → 151 unique addresses + 1 empty-address group = 152 deliveries.
    // Empty-address rows are not dropped here; downstream geocoding will mark them
    // as unassignable.
    const buf = readFileSync(resolve(__dirname, "../../../../test/fixtures/totsuka-0417.xlsx"));
    const file = new File([buf], "totsuka-0417.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await parseExcelFile(file);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deliveries).toHaveLength(152);
      const totalVolume = result.deliveries.reduce((s, d) => s + d.volume, 0);
      const totalWeight = result.deliveries.reduce((s, d) => s + d.actualWeight, 0);
      expect(totalVolume).toBe(65483);
      expect(totalWeight).toBe(15702);
      // Threshold = light maxVolume(4500) / 3 = 1500L (per design §6.3)
      const truckCandidates = result.deliveries.filter((d) => d.volume >= 1500);
      const lightCandidates = result.deliveries.filter((d) => d.volume < 1500);
      expect(truckCandidates).toHaveLength(9);
      expect(lightCandidates).toHaveLength(143);
    }
  });
});
