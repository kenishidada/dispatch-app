import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import { Delivery, SlipDetail } from "@/shared/types/delivery";
import { normalizeAddress } from "@/lib/address";

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

        type RawRow = Record<string, unknown>;

        const groups = new Map<string, { rep: RawRow; rawAddr: string; rows: RawRow[] }>();
        for (const row of jsonData) {
          const rawAddr = String(row["届先住所"] ?? "");
          const key = normalizeAddress(rawAddr);
          const existing = groups.get(key);
          if (existing) {
            existing.rows.push(row);
          } else {
            groups.set(key, { rep: row, rawAddr, rows: [row] });
          }
        }

        const deliveries: Delivery[] = Array.from(groups.entries()).map(([normalizedAddr, group]) => {
          const slips: SlipDetail[] = group.rows.map((r) => ({
            slipNumber: Number(r["伝票番号"] ?? 0),
            shippingNumber: Number(r["出荷番号"] ?? 0),
            packageCount: Number(r["個口数"] ?? 0),
            quantity: Number(r["数 量"] ?? 0),
            caseCount: Number(r["甲数"] ?? 0),
            assortQuantity: Number(r["ｱｿｰﾄ数量"] ?? 0),
            actualWeight: Number(r["実重量"] ?? 0),
            volume: Number(r["容積"] ?? 0),
            factoryName: String(r["工場名"] ?? ""),
          }));
          const sum = (k: keyof SlipDetail) =>
            slips.reduce((s, x) => s + (Number(x[k]) || 0), 0);
          const rep = group.rep;
          return {
            id: uuidv4(),
            factoryName: String(rep["工場名"] ?? ""),
            carrierCode: Number(rep["運送業者コード"] ?? 0),
            carrierName: String(rep["運送業者名"] ?? ""),
            destinationCode: Number(rep["届先コード"] ?? 0),
            destinationName: String(rep["届先名"] ?? ""),
            packageCount: sum("packageCount"),
            quantity: sum("quantity"),
            caseCount: sum("caseCount"),
            assortQuantity: sum("assortQuantity"),
            actualWeight: sum("actualWeight"),
            volume: sum("volume"),
            addressCode: Number(rep["住所コード"] ?? 0),
            address: normalizedAddr,
            rawAddress: group.rawAddr,
            deliveryDate: String(rep["納品日"] ?? ""),
            slipNumber: Number(rep["伝票番号"] ?? 0),
            shippingNumber: Number(rep["出荷番号"] ?? 0),
            shippingCategory: String(rep["運送区分"] ?? ""),
            slips,
            lat: null,
            lng: null,
            courseId: null,
            colorCode: null,
            isUndelivered: false,
            memo: "",
            assignReason: "",
            unassignedReason: "",
            geocodeStatus: "pending",
          };
        });

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
