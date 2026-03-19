import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import { Delivery } from "@/shared/types/delivery";

type ParseResult = {
  success: true;
  deliveries: Delivery[];
} | {
  success: false;
  error: string;
};

const EXPECTED_HEADERS = [
  "工場名", "運送業者コード", "運送業者名", "届先コード", "届先名",
  "個口数", "数 量", "甲数", "ｱｿｰﾄ数量", "実重量", "容積",
  "住所コード", "届先住所", "納品日", "伝票番号", "出荷番号", "運送区分",
];

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ success: false, error: "Excelファイルにシートが見つかりません" });
          return;
        }

        const worksheet = workbook.Sheets[sheetName];

        // Validate headers
        const headerRow = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, range: "A1:Q1" });
        if (!headerRow[0] || headerRow[0].length < 17) {
          resolve({ success: false, error: "Excelの列構造が想定と異なります。17列のデータが必要です。" });
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          header: EXPECTED_HEADERS,
          range: 1,
        });

        if (jsonData.length === 0) {
          resolve({ success: false, error: "データ行が見つかりません" });
          return;
        }

        const deliveries: Delivery[] = jsonData.map((row) => ({
          id: uuidv4(),
          factoryName: String(row["工場名"] ?? ""),
          carrierCode: Number(row["運送業者コード"] ?? 0),
          carrierName: String(row["運送業者名"] ?? ""),
          destinationCode: Number(row["届先コード"] ?? 0),
          destinationName: String(row["届先名"] ?? ""),
          packageCount: Number(row["個口数"] ?? 0),
          quantity: Number(row["数 量"] ?? 0),
          caseCount: Number(row["甲数"] ?? 0),
          assortQuantity: Number(row["ｱｿｰﾄ数量"] ?? 0),
          actualWeight: Number(row["実重量"] ?? 0),
          volume: Number(row["容積"] ?? 0),
          addressCode: Number(row["住所コード"] ?? 0),
          address: String(row["届先住所"] ?? ""),
          deliveryDate: String(row["納品日"] ?? ""),
          slipNumber: Number(row["伝票番号"] ?? 0),
          shippingNumber: Number(row["出荷番号"] ?? 0),
          shippingCategory: String(row["運送区分"] ?? ""),
          lat: null,
          lng: null,
          driverName: null,
          colorCode: null,
          isUndelivered: false,
          memo: "",
          assignReason: "",
          geocodeStatus: "pending",
        }));

        resolve({ success: true, deliveries });
      } catch {
        resolve({ success: false, error: "Excelファイルの読み込みに失敗しました" });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: "ファイルの読み込みに失敗しました" });
    };

    reader.readAsArrayBuffer(file);
  });
}
