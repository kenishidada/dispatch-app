import { describe, it, expect } from "vitest";
import { parseExcelFile } from "../useExcelParser";
import * as XLSX from "xlsx";

function createMockExcelFile(data: unknown[][], sheetName = "Sheet1"): File {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const HEADERS = [
  "工場名", "運送業者コード", "運送業者名", "届先コード", "届先名",
  "個口数", "数 量", "甲数", "ｱｿｰﾄ数量", "実重量", "容積",
  "住所コード", "届先住所", "納品日", "伝票番号", "出荷番号", "運送区分",
];

describe("parseExcelFile", () => {
  it("parses valid Excel file into Delivery array", async () => {
    const data = [
      HEADERS,
      ["工場A", 100, "運送A", 200, "届先A", 3, 10, 2, 0, 50, 120, 14100, "横浜市戸塚区", "320", 12345678, 87654321, "関東"],
    ];
    const file = createMockExcelFile(data);
    const result = await parseExcelFile(file);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deliveries).toHaveLength(1);
      expect(result.deliveries[0].destinationName).toBe("届先A");
      expect(result.deliveries[0].volume).toBe(120);
      expect(result.deliveries[0].geocodeStatus).toBe("pending");
      expect(result.deliveries[0].driverName).toBeNull();
      expect(result.deliveries[0].slips).toHaveLength(1);
      expect(result.deliveries[0].rawAddress).toBe("横浜市戸塚区");
    }
  });

  it("aggregates rows with same normalized address into one Delivery", async () => {
    const data = [
      HEADERS,
      ["工場A", 100, "運送A", 200, "届先A", 3, 10, 2, 0, 50, 120, 14100, "横浜市戸塚区１２３", "320", 1001, 8001, "関東"],
      ["工場B", 100, "運送A", 200, "届先A", 2, 5, 1, 0, 30, 80, 14100, "横浜市戸塚区123", "320", 1002, 8002, "関東"],
      ["工場A", 100, "運送A", 201, "届先B", 1, 3, 1, 0, 20, 60, 14101, "横浜市戸塚区456", "320", 1003, 8003, "関東"],
    ];
    const file = createMockExcelFile(data);
    const result = await parseExcelFile(file);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deliveries).toHaveLength(2);
      const aggregated = result.deliveries.find((d) => d.address === "横浜市戸塚区123");
      expect(aggregated).toBeDefined();
      expect(aggregated!.slips).toHaveLength(2);
      expect(aggregated!.volume).toBe(200);
      expect(aggregated!.actualWeight).toBe(80);
      expect(aggregated!.packageCount).toBe(5);
      expect(aggregated!.rawAddress).toBe("横浜市戸塚区１２３");
    }
  });

  it("returns error for empty data rows", async () => {
    const data = [HEADERS];
    const file = createMockExcelFile(data);
    const result = await parseExcelFile(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("データ行");
    }
  });

  it("returns error for file with too few columns", async () => {
    const data = [["A", "B", "C"], [1, 2, 3]];
    const file = createMockExcelFile(data);
    const result = await parseExcelFile(file);
    expect(result.success).toBe(false);
  });
});
