# 配送振り分け精度改善 + Railway 移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配送振り分けの精度を改善し、住所重複集約・車両スペック制約・決定論+AI 6段階パイプライン・コース概念導入・Railway 移行を実装する

**Architecture:** Expand-contract 戦略で段階的に移行する。Phase 1 で新型・新ライブラリを既存と並列に追加（ビルド維持）、Phase 2 で API・パイプラインを切替、Phase 3 で UI を更新、Phase 4 で旧型・旧フィールドを削除、Phase 5 で Railway 設定。各タスクの commit 時点でビルドとテストが通る状態を保つ。

**Tech Stack:** Next.js 16 / React 19 / Zustand 5 (persist) / Vitest / Gemini API (`@google/generative-ai`) / XLSX / Leaflet / Railway (Nixpacks)

**Spec:** `docs/superpowers/specs/2026-04-18-assignment-precision-improvement-design.md`

---

## Phase 1: Foundation（純追加・ビルド維持）

### Task 1: 新型を既存型と並列に追加

**Files:**
- Modify: `src/shared/types/delivery.ts`

- [ ] **Step 1: 新型を既存ファイルに追加**

`src/shared/types/delivery.ts` の末尾に以下を追加（既存の `Driver` / `DEFAULT_DRIVERS` / `AreaRule` は残す）:

```ts
export type Course = {
  id: string;
  name: string;
  vehicleType: "light" | "2t";
  color: string;
  defaultRegion: string;
};

export type VehicleSpec = {
  vehicleType: "light" | "2t";
  maxVolume: number;
  maxWeight: number;
  maxOrders: number;
};

export type SlipDetail = {
  slipNumber: number;
  shippingNumber: number;
  packageCount: number;
  quantity: number;
  caseCount: number;
  assortQuantity: number;
  actualWeight: number;
  volume: number;
  factoryName: string;
};

export type AssignmentLogEntry = {
  step: number;
  title: string;
  message: string;
  timestamp: number;
};

export type CapacityWarning = {
  courseId: string;
  type: "volume" | "weight" | "orders";
  current: number;
  limit: number;
  message: string;
};

export const DEFAULT_COURSES: Course[] = [
  { id: "light-1", name: "軽1", vehicleType: "light", color: "#34A853", defaultRegion: "" },
  { id: "light-2", name: "軽2", vehicleType: "light", color: "#4285F4", defaultRegion: "" },
  { id: "light-3", name: "軽3", vehicleType: "light", color: "#F9AB00", defaultRegion: "" },
  { id: "light-4", name: "軽4", vehicleType: "light", color: "#FF6D01", defaultRegion: "" },
  { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#EA4335", defaultRegion: "" },
  { id: "truck-2", name: "2t2", vehicleType: "2t", color: "#A142F4", defaultRegion: "" },
];

export const DEFAULT_VEHICLE_SPECS: VehicleSpec[] = [
  { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
  { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
];
```

`Delivery` 型に新フィールドを追加（既存フィールドは残す）:

```ts
export type Delivery = {
  // 既存フィールドはすべて維持
  id: string;
  factoryName: string;
  carrierCode: number;
  carrierName: string;
  destinationCode: number;
  destinationName: string;
  packageCount: number;
  quantity: number;
  caseCount: number;
  assortQuantity: number;
  actualWeight: number;
  volume: number;
  addressCode: number;
  address: string;
  deliveryDate: string;
  slipNumber: number;
  shippingNumber: number;
  shippingCategory: string;
  lat: number | null;
  lng: number | null;
  driverName: string | null;
  colorCode: string | null;
  isUndelivered: boolean;
  memo: string;
  assignReason: string;
  geocodeStatus: GeoCodeStatus;
  // 新規（Phase 1 では optional、Phase 4 で必須化）
  rawAddress?: string;
  slips?: SlipDetail[];
  courseId?: string | null;
  unassignedReason?: string;
};
```

`AreaRule` 型に `courseId` を追加（既存は残す）:

```ts
export type AreaRule = {
  id: string;
  region: string;
  driverName: string;
  vehicleType: "2t" | "light";
  courseId?: string;  // 新規（Phase 4 で必須化、driverName/vehicleType を削除）
};
```

- [ ] **Step 2: 型エラーがないことを確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/shared/types/delivery.ts
git commit -m "feat: add Course/VehicleSpec/SlipDetail types alongside existing Driver"
```

---

### Task 2: 住所正規化関数の追加とテスト

**Files:**
- Create: `src/lib/address.ts`
- Create: `src/lib/__tests__/address.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/address.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeAddress } from "../address";

describe("normalizeAddress", () => {
  it("converts full-width digits to half-width", () => {
    expect(normalizeAddress("横浜市戸塚区１２３")).toBe("横浜市戸塚区123");
  });

  it("converts full-width latin to half-width", () => {
    expect(normalizeAddress("ＡＢＣ横浜")).toBe("ABC横浜");
  });

  it("normalizes various dashes to hyphen", () => {
    expect(normalizeAddress("戸塚1ー2―3‐4－5")).toBe("戸塚1-2-3-4-5");
  });

  it("collapses whitespace", () => {
    expect(normalizeAddress("横浜市  戸塚区   上矢部")).toBe("横浜市 戸塚区 上矢部");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeAddress("  横浜市戸塚区  ")).toBe("横浜市戸塚区");
  });

  it("returns empty for empty input", () => {
    expect(normalizeAddress("")).toBe("");
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/address.test.ts`
Expected: 6 failures with "Cannot find module '../address'"

- [ ] **Step 3: 実装**

`src/lib/address.ts`:

```ts
export function normalizeAddress(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ー－―‐]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/address.test.ts`
Expected: 6 passed

- [ ] **Step 5: コミット**

```bash
git add src/lib/address.ts src/lib/__tests__/address.test.ts
git commit -m "feat: add normalizeAddress utility for address aggregation key"
```

---

### Task 3: Excel パース時の住所集約

**Files:**
- Modify: `src/features/upload/hooks/useExcelParser.ts`
- Modify: `src/features/upload/hooks/__tests__/useExcelParser.test.ts`

- [ ] **Step 1: 集約テストを追加（失敗）**

`src/features/upload/hooks/__tests__/useExcelParser.test.ts` の `describe` ブロック内に追加:

```ts
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
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/features/upload/hooks/__tests__/useExcelParser.test.ts`
Expected: new test fails (slips undefined or 3 deliveries returned)

- [ ] **Step 3: useExcelParser.ts に集約ロジック実装**

`src/features/upload/hooks/useExcelParser.ts` の import に追加:

```ts
import { Delivery, SlipDetail } from "@/shared/types/delivery";
import { normalizeAddress } from "@/lib/address";
```

`jsonData.map(...)` を以下に置き換え:

```ts
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
  const sum = (k: keyof SlipDetail) => slips.reduce((s, x) => s + (Number(x[k]) || 0), 0);
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
    driverName: null,
    courseId: null,
    colorCode: null,
    isUndelivered: false,
    memo: "",
    assignReason: "",
    unassignedReason: "",
    geocodeStatus: "pending",
  };
});
```

- [ ] **Step 4: 既存テスト1件目を更新（1行 → 1集約）**

既存の "parses valid Excel file into Delivery array" テスト内の `result.deliveries[0].driverName` チェックは維持。`destinationName` / `volume` / `geocodeStatus` のチェックも維持。1行入力なので集約後も1件のまま。追加で `result.deliveries[0].address` が正規化されている確認を追加:

```ts
      expect(result.deliveries[0].slips).toHaveLength(1);
      expect(result.deliveries[0].rawAddress).toBe("横浜市戸塚区");
```

- [ ] **Step 5: テスト通過を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/features/upload/hooks/__tests__/useExcelParser.test.ts`
Expected: 4 passed

- [ ] **Step 6: コミット**

```bash
git add src/features/upload/hooks/useExcelParser.ts src/features/upload/hooks/__tests__/useExcelParser.test.ts
git commit -m "feat: aggregate Excel rows by normalized address into single Delivery"
```

---

### Task 4: 戸塚0417 実データでのゴールデン集約テスト

**Files:**
- Create: `src/features/upload/hooks/__tests__/useExcelParser.golden.test.ts`
- Create: `src/test/fixtures/totsuka-0417.xlsx` (copy from `/Users/ken/Desktop/戸塚0417 (1).xlsx`)

- [ ] **Step 1: フィクスチャをリポジトリに配置**

```bash
mkdir -p /Users/ken/Desktop/develop/dispatch-app/src/test/fixtures
cp "/Users/ken/Desktop/戸塚0417 (1).xlsx" /Users/ken/Desktop/develop/dispatch-app/src/test/fixtures/totsuka-0417.xlsx
```

- [ ] **Step 2: ゴールデンテストを作成**

`src/features/upload/hooks/__tests__/useExcelParser.golden.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseExcelFile } from "../useExcelParser";

describe("parseExcelFile (golden: totsuka-0417)", () => {
  it("aggregates 277 rows to 152 unique deliveries with expected totals", async () => {
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
      const truckCandidates = result.deliveries.filter((d) => d.volume >= 1500);
      const lightCandidates = result.deliveries.filter((d) => d.volume < 1500);
      expect(truckCandidates).toHaveLength(14);
      expect(lightCandidates).toHaveLength(138);
    }
  });
});
```

- [ ] **Step 3: テスト実行**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/features/upload/hooks/__tests__/useExcelParser.golden.test.ts`
Expected: 1 passed

- [ ] **Step 4: コミット**

```bash
git add src/test/fixtures/totsuka-0417.xlsx src/features/upload/hooks/__tests__/useExcelParser.golden.test.ts
git commit -m "test: add golden aggregation test for totsuka-0417 real data"
```

---

### Task 5: DBSCAN クラスタリング実装

**Files:**
- Create: `src/lib/clustering.ts`
- Create: `src/lib/__tests__/clustering.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/clustering.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dbscan, haversineKm } from "../clustering";

describe("haversineKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineKm(35.4, 139.5, 35.4, 139.5)).toBeCloseTo(0, 3);
  });

  it("returns ~111km for 1 degree latitude", () => {
    const d = haversineKm(35, 139, 36, 139);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe("dbscan", () => {
  it("groups close points into one cluster", () => {
    const points = [
      { id: "a", lat: 35.4000, lng: 139.5000 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "c", lat: 35.4002, lng: 139.5002 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
    expect(result.get("c")).toBe(0);
  });

  it("separates distant points into different clusters", () => {
    const points = [
      { id: "a", lat: 35.4, lng: 139.5 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "c", lat: 35.6, lng: 139.7 },
      { id: "d", lat: 35.6001, lng: 139.7001 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("a")).toBe(result.get("b"));
    expect(result.get("c")).toBe(result.get("d"));
    expect(result.get("a")).not.toBe(result.get("c"));
  });

  it("marks isolated points as noise (-1)", () => {
    const points = [
      { id: "a", lat: 35.4, lng: 139.5 },
      { id: "b", lat: 35.4001, lng: 139.5001 },
      { id: "noise", lat: 36.5, lng: 140.5 },
    ];
    const result = dbscan(points, { epsKm: 5, minPts: 2 });
    expect(result.get("noise")).toBe(-1);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/clustering.test.ts`
Expected: failures with "Cannot find module '../clustering'"

- [ ] **Step 3: 実装**

`src/lib/clustering.ts`:

```ts
export type ClusterPoint = { id: string; lat: number; lng: number };
export type DbscanOptions = { epsKm: number; minPts: number };

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function dbscan(points: ClusterPoint[], opts: DbscanOptions): Map<string, number> {
  const { epsKm, minPts } = opts;
  const labels = new Map<string, number>();
  const visited = new Set<string>();
  let clusterId = 0;

  const neighbors = (p: ClusterPoint) =>
    points.filter((q) => q.id !== p.id && haversineKm(p.lat, p.lng, q.lat, q.lng) <= epsKm);

  for (const p of points) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);
    const ns = neighbors(p);
    if (ns.length + 1 < minPts) {
      labels.set(p.id, -1);
      continue;
    }
    labels.set(p.id, clusterId);
    const queue = [...ns];
    while (queue.length > 0) {
      const q = queue.shift()!;
      if (!visited.has(q.id)) {
        visited.add(q.id);
        const qns = neighbors(q);
        if (qns.length + 1 >= minPts) queue.push(...qns.filter((x) => !visited.has(x.id)));
      }
      if (!labels.has(q.id) || labels.get(q.id) === -1) labels.set(q.id, clusterId);
    }
    clusterId++;
  }
  return labels;
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/clustering.test.ts`
Expected: 5 passed

- [ ] **Step 5: コミット**

```bash
git add src/lib/clustering.ts src/lib/__tests__/clustering.test.ts
git commit -m "feat: add DBSCAN geographic clustering with haversine distance"
```

---

### Task 6: 大口閾値関数と容量チェック関数

**Files:**
- Create: `src/lib/capacity.ts`
- Create: `src/lib/__tests__/capacity.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/capacity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTruckThreshold, checkCapacity } from "../capacity";
import type { Delivery, Course, VehicleSpec } from "@/shared/types/delivery";

describe("getTruckThreshold", () => {
  it("derives threshold as light maxVolume / 3", () => {
    const specs: VehicleSpec[] = [
      { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
      { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
    ];
    expect(getTruckThreshold(specs)).toBe(1500);
  });

  it("falls back to 1500 when light spec missing", () => {
    expect(getTruckThreshold([])).toBe(1500);
  });
});

describe("checkCapacity", () => {
  const courses: Course[] = [
    { id: "light-1", name: "軽1", vehicleType: "light", color: "#000", defaultRegion: "" },
    { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#000", defaultRegion: "" },
  ];
  const specs: VehicleSpec[] = [
    { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
    { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
  ];
  function makeDelivery(id: string, volume: number, weight: number): Delivery {
    return {
      id, factoryName: "", carrierCode: 0, carrierName: "",
      destinationCode: 0, destinationName: "", packageCount: 0, quantity: 0,
      caseCount: 0, assortQuantity: 0, actualWeight: weight, volume, addressCode: 0,
      address: "", deliveryDate: "", slipNumber: 0, shippingNumber: 0,
      shippingCategory: "", lat: 0, lng: 0, driverName: null, colorCode: null,
      isUndelivered: false, memo: "", assignReason: "", geocodeStatus: "success",
    };
  }

  it("returns no warnings when within limits", () => {
    const deliveries = [makeDelivery("d1", 1000, 100)];
    const assignments = [{ deliveryId: "d1", courseId: "light-1" }];
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    expect(w).toHaveLength(0);
  });

  it("reports volume overage", () => {
    const deliveries = [makeDelivery("d1", 5000, 100)];
    const assignments = [{ deliveryId: "d1", courseId: "light-1" }];
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    expect(w).toHaveLength(1);
    expect(w[0].type).toBe("volume");
    expect(w[0].current).toBe(5000);
    expect(w[0].limit).toBe(4500);
  });

  it("reports order count overage", () => {
    const deliveries = Array.from({ length: 26 }, (_, i) => makeDelivery(`d${i}`, 100, 10));
    const assignments = deliveries.map((d) => ({ deliveryId: d.id, courseId: "light-1" }));
    const w = checkCapacity(assignments, deliveries, courses, specs, ["light-1"]);
    const orders = w.find((x) => x.type === "orders");
    expect(orders).toBeDefined();
    expect(orders!.current).toBe(26);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/capacity.test.ts`
Expected: failures with "Cannot find module '../capacity'"

- [ ] **Step 3: 実装**

`src/lib/capacity.ts`:

```ts
import type { Delivery, Course, VehicleSpec, CapacityWarning } from "@/shared/types/delivery";

export function getTruckThreshold(vehicleSpecs: VehicleSpec[]): number {
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  return lightSpec ? Math.floor(lightSpec.maxVolume / 3) : 1500;
}

export type AssignmentLite = { deliveryId: string; courseId: string | null };

export function checkCapacity(
  assignments: AssignmentLite[],
  deliveries: Delivery[],
  courses: Course[],
  vehicleSpecs: VehicleSpec[],
  activeCourseIds: string[]
): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  const assignMap = new Map(assignments.map((a) => [a.deliveryId, a.courseId]));
  for (const courseId of activeCourseIds) {
    const course = courses.find((c) => c.id === courseId);
    if (!course) continue;
    const spec = vehicleSpecs.find((s) => s.vehicleType === course.vehicleType);
    if (!spec) continue;
    const assigned = deliveries.filter((d) => assignMap.get(d.id) === courseId);
    const totalVolume = assigned.reduce((s, d) => s + d.volume, 0);
    const totalWeight = assigned.reduce((s, d) => s + d.actualWeight, 0);
    const totalOrders = assigned.length;
    if (totalVolume > spec.maxVolume) {
      warnings.push({
        courseId, type: "volume", current: totalVolume, limit: spec.maxVolume,
        message: `${course.name}: 容積 ${totalVolume}/${spec.maxVolume}L (${totalVolume - spec.maxVolume}L 超過)`,
      });
    }
    if (totalWeight > spec.maxWeight) {
      warnings.push({
        courseId, type: "weight", current: totalWeight, limit: spec.maxWeight,
        message: `${course.name}: 重量 ${totalWeight}/${spec.maxWeight}kg (${totalWeight - spec.maxWeight}kg 超過)`,
      });
    }
    if (totalOrders > spec.maxOrders) {
      warnings.push({
        courseId, type: "orders", current: totalOrders, limit: spec.maxOrders,
        message: `${course.name}: 件数 ${totalOrders}/${spec.maxOrders}件 (${totalOrders - spec.maxOrders}件 超過)`,
      });
    }
  }
  return warnings;
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/capacity.test.ts`
Expected: 5 passed

- [ ] **Step 5: コミット**

```bash
git add src/lib/capacity.ts src/lib/__tests__/capacity.test.ts
git commit -m "feat: add getTruckThreshold and checkCapacity utilities"
```

---

### Task 7: Zustand store に新フィールド追加 + v1→v2 マイグレーション

**Files:**
- Modify: `src/shared/store/deliveryStore.ts`
- Create: `src/shared/store/__tests__/deliveryStore.migrate.test.ts`

- [ ] **Step 1: 失敗するマイグレーションテストを書く**

`src/shared/store/__tests__/deliveryStore.migrate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateStore } from "../deliveryStore";

describe("migrateStore v1 -> v2", () => {
  it("converts drivers to courses preserving names and colors", () => {
    const v1 = {
      drivers: [
        { name: "コース1（軽）", color: "#34A853", vehicleType: "light" },
        { name: "2t-右", color: "#EA4335", vehicleType: "2t" },
      ],
      areaRules: [],
      areaImage: null,
      areaDescription: "",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const courses = result.courses as Array<{ id: string; name: string; vehicleType: string; color: string }>;
    expect(courses).toHaveLength(2);
    expect(courses[0]).toMatchObject({ id: "light-1", name: "コース1（軽）", vehicleType: "light", color: "#34A853" });
    expect(courses[1]).toMatchObject({ id: "truck-1", name: "2t-右", vehicleType: "2t", color: "#EA4335" });
  });

  it("preserves areaImage / areaDescription", () => {
    const v1 = {
      drivers: [],
      areaRules: [],
      areaImage: "data:image/png;base64,xxx",
      areaDescription: "横浜は2t",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    expect(result.areaImage).toBe("data:image/png;base64,xxx");
    expect(result.areaDescription).toBe("横浜は2t");
  });

  it("converts areaRules.driverName to courseId", () => {
    const v1 = {
      drivers: [
        { name: "軽1", color: "#000", vehicleType: "light" },
      ],
      areaRules: [
        { id: "r1", region: "横浜", driverName: "軽1" },
      ],
      areaImage: null,
      areaDescription: "",
    };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const rules = result.areaRules as Array<{ id: string; region: string; courseId: string }>;
    expect(rules[0].courseId).toBe("light-1");
  });

  it("uses DEFAULT_COURSES when drivers empty", () => {
    const v1 = { drivers: [], areaRules: [], areaImage: null, areaDescription: "" };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const courses = result.courses as unknown[];
    expect(courses.length).toBeGreaterThan(0);
  });

  it("adds default vehicleSpecs", () => {
    const v1 = { drivers: [], areaRules: [], areaImage: null, areaDescription: "" };
    const result = migrateStore(v1, 1) as Record<string, unknown>;
    const specs = result.vehicleSpecs as unknown[];
    expect(specs).toHaveLength(2);
  });

  it("returns state unchanged when version >= 2", () => {
    const v2 = { courses: [], vehicleSpecs: [] };
    expect(migrateStore(v2, 2)).toBe(v2);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/shared/store/__tests__/deliveryStore.migrate.test.ts`
Expected: failures with "migrateStore is not exported"

- [ ] **Step 3: store を更新**

`src/shared/store/deliveryStore.ts` を完全に書き換える:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Delivery, Driver, AreaRule, Course, VehicleSpec,
  AssignmentLogEntry, CapacityWarning,
  DEFAULT_DRIVERS, DEFAULT_COURSES, DEFAULT_VEHICLE_SPECS,
} from "@/shared/types/delivery";

export function migrateStore(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  if (version >= 2) return persistedState;
  const s = persistedState as Record<string, unknown>;
  const oldDrivers =
    (s.drivers as Array<{ name: string; color: string; vehicleType: "light" | "2t" }> | undefined) ?? [];
  let lightIdx = 0;
  let truckIdx = 0;
  const courses: Course[] = oldDrivers.length > 0
    ? oldDrivers.map((d) => {
        const isTruck = d.vehicleType === "2t";
        const idx = isTruck ? ++truckIdx : ++lightIdx;
        return {
          id: `${isTruck ? "truck" : "light"}-${idx}`,
          name: d.name,
          vehicleType: d.vehicleType,
          color: d.color,
          defaultRegion: "",
        };
      })
    : DEFAULT_COURSES;
  const oldRules =
    (s.areaRules as Array<{ id: string; region: string; driverName: string }> | undefined) ?? [];
  const areaRules: AreaRule[] = oldRules.map((r) => {
    const matched = courses.find((c) => c.name === r.driverName);
    return {
      id: r.id,
      region: r.region,
      driverName: r.driverName,
      vehicleType: matched?.vehicleType ?? "light",
      courseId: matched?.id ?? courses[0]?.id ?? "",
    };
  });
  return {
    courses,
    vehicleSpecs: DEFAULT_VEHICLE_SPECS,
    areaRules,
    areaImage: s.areaImage ?? null,
    areaDescription: s.areaDescription ?? "",
  };
}

type DeliveryStore = {
  deliveries: Delivery[];
  drivers: Driver[];                    // Phase 4 で削除
  courses: Course[];
  vehicleSpecs: VehicleSpec[];
  areaRules: AreaRule[];
  areaImage: string | null;
  areaDescription: string;
  selectedDeliveryId: string | null;
  selectedDeliveryIds: Set<string>;
  driverFilter: Set<string> | null;     // Phase 4 で削除
  courseFilter: Set<string> | null;
  activeCourseIds: string[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  uploadedFileName: string;
  isProcessing: boolean;
  processingStep: string;

  // 既存メソッド
  setDeliveries: (deliveries: Delivery[]) => void;
  mergeDeliveries: (newData: Delivery[]) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;
  updateDriverAssignment: (id: string, driverName: string) => void;
  toggleUndelivered: (id: string) => void;
  setMemo: (id: string, memo: string) => void;
  setDrivers: (drivers: Driver[]) => void;
  setAreaRules: (rules: AreaRule[]) => void;
  setAreaImage: (image: string | null) => void;
  setAreaDescription: (desc: string) => void;
  selectDelivery: (id: string | null) => void;
  setUploadedFileName: (name: string) => void;
  setDriverFilter: (filter: Set<string> | null) => void;
  toggleDriverFilter: (driverName: string) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
  toggleSelectDelivery: (id: string) => void;
  selectAllVisible: (ids: string[]) => void;
  clearSelection: () => void;
  bulkAssignDriver: (ids: string[], driverName: string) => void;
  // 新規メソッド
  setCourses: (courses: Course[]) => void;
  setVehicleSpecs: (specs: VehicleSpec[]) => void;
  updateCourseAssignment: (id: string, courseId: string | null) => void;
  bulkAssignCourse: (ids: string[], courseId: string | null) => void;
  setActiveCourseIds: (ids: string[]) => void;
  setAssignmentLog: (log: AssignmentLogEntry[]) => void;
  setCapacityWarnings: (w: CapacityWarning[]) => void;
  setCourseFilter: (filter: Set<string> | null) => void;
  toggleCourseFilter: (courseId: string) => void;
  clearAssignmentResults: () => void;
};

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set, get) => ({
      deliveries: [],
      drivers: DEFAULT_DRIVERS,
      courses: DEFAULT_COURSES,
      vehicleSpecs: DEFAULT_VEHICLE_SPECS,
      areaRules: [],
      areaImage: null,
      areaDescription: "",
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set<string>(),
      driverFilter: null,
      courseFilter: null,
      activeCourseIds: [],
      assignmentLog: [],
      capacityWarnings: [],
      uploadedFileName: "",
      isProcessing: false,
      processingStep: "",

      setDeliveries: (deliveries) => set({ deliveries }),
      mergeDeliveries: (newData) => {
        const existing = get().deliveries;
        const newSlipNumbers = new Set(newData.map((d) => d.slipNumber));
        const keptUndelivered = existing.filter(
          (d) => d.isUndelivered && !newSlipNumbers.has(d.slipNumber)
        );
        set({ deliveries: [...keptUndelivered, ...newData] });
      },
      updateDelivery: (id, updates) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, ...updates } : d)) }),
      updateDriverAssignment: (id, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, driverName, colorCode: driver?.color ?? null } : d
          ),
        });
      },
      toggleUndelivered: (id) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, isUndelivered: !d.isUndelivered } : d)) }),
      setMemo: (id, memo) =>
        set({ deliveries: get().deliveries.map((d) => (d.id === id ? { ...d, memo } : d)) }),
      setDrivers: (drivers) => set({ drivers }),
      setAreaRules: (rules) => set({ areaRules: rules }),
      setAreaImage: (image) => set({ areaImage: image }),
      setAreaDescription: (desc) => set({ areaDescription: desc }),
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setUploadedFileName: (name) => set({ uploadedFileName: name }),
      setDriverFilter: (filter) => set({ driverFilter: filter }),
      toggleDriverFilter: (driverName) => {
        const current = get().driverFilter;
        if (current === null) set({ driverFilter: new Set([driverName]) });
        else {
          const next = new Set(current);
          if (next.has(driverName)) {
            next.delete(driverName);
            set({ driverFilter: next.size === 0 ? null : next });
          } else { next.add(driverName); set({ driverFilter: next }); }
        }
      },
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),
      toggleSelectDelivery: (id) => {
        const current = new Set(get().selectedDeliveryIds);
        if (current.has(id)) current.delete(id); else current.add(id);
        set({ selectedDeliveryIds: current });
      },
      selectAllVisible: (ids) => set({ selectedDeliveryIds: new Set(ids) }),
      clearSelection: () => set({ selectedDeliveryIds: new Set<string>() }),
      bulkAssignDriver: (ids, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        const idSet = new Set(ids);
        set({
          deliveries: get().deliveries.map((d) =>
            idSet.has(d.id) ? { ...d, driverName, colorCode: driver?.color ?? null } : d
          ),
          selectedDeliveryIds: new Set<string>(),
        });
      },

      setCourses: (courses) => set({ courses }),
      setVehicleSpecs: (specs) => set({ vehicleSpecs: specs }),
      updateCourseAssignment: (id, courseId) => {
        const course = get().courses.find((c) => c.id === courseId);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id
              ? { ...d, courseId, colorCode: course?.color ?? null, driverName: course?.name ?? null }
              : d
          ),
        });
      },
      bulkAssignCourse: (ids, courseId) => {
        const course = get().courses.find((c) => c.id === courseId);
        const idSet = new Set(ids);
        set({
          deliveries: get().deliveries.map((d) =>
            idSet.has(d.id)
              ? { ...d, courseId, colorCode: course?.color ?? null, driverName: course?.name ?? null }
              : d
          ),
          selectedDeliveryIds: new Set<string>(),
        });
      },
      setActiveCourseIds: (ids) => set({ activeCourseIds: ids }),
      setAssignmentLog: (log) => set({ assignmentLog: log }),
      setCapacityWarnings: (w) => set({ capacityWarnings: w }),
      setCourseFilter: (filter) => set({ courseFilter: filter }),
      toggleCourseFilter: (courseId) => {
        const current = get().courseFilter;
        if (current === null) set({ courseFilter: new Set([courseId]) });
        else {
          const next = new Set(current);
          if (next.has(courseId)) {
            next.delete(courseId);
            set({ courseFilter: next.size === 0 ? null : next });
          } else { next.add(courseId); set({ courseFilter: next }); }
        }
      },
      clearAssignmentResults: () =>
        set({
          deliveries: get().deliveries.map((d) => ({
            ...d, courseId: null, driverName: null, colorCode: null, assignReason: "", unassignedReason: "",
          })),
          assignmentLog: [],
          capacityWarnings: [],
        }),
    }),
    {
      name: "delivery-store",
      version: 2,
      partialize: (state) => ({
        courses: state.courses,
        vehicleSpecs: state.vehicleSpecs,
        areaRules: state.areaRules,
        areaImage: state.areaImage,
        areaDescription: state.areaDescription,
      }),
      migrate: migrateStore as (s: unknown, v: number) => DeliveryStore | Promise<DeliveryStore>,
    }
  )
);
```

- [ ] **Step 4: テスト通過を確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/shared/store/__tests__/deliveryStore.migrate.test.ts`
Expected: 6 passed

- [ ] **Step 5: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: コミット**

```bash
git add src/shared/store/deliveryStore.ts src/shared/store/__tests__/deliveryStore.migrate.test.ts
git commit -m "feat: add courses/vehicleSpecs to store with v1->v2 migration"
```

---

## Phase 2: 振り分けパイプライン

### Task 8: gemini.ts を 6段階パイプラインに書き換え（前半: 段階0-4）

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: 全面書き換え**

`src/lib/gemini.ts` を以下に置き換える:

```ts
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
};

const EPS_KM = Number(process.env.DBSCAN_EPS_KM || "5");
const MIN_PTS = Number(process.env.DBSCAN_MIN_PTS || "2");

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
    ? "\n【エリアルール】\n" + areaRules.map((r) => `- ${r.region} → ${r.courseId ?? r.driverName}`).join("\n")
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
  areaImage: string | null,
  areaDescription: string
): Promise<AutoAssignOutput> {
  const log: AssignmentLogEntry[] = [];

  // 段階0: 画像→テキスト変換
  let effectiveDescription = areaDescription;
  if (areaImage) {
    const imageRules = await extractAreaRulesFromImage(areaImage, courses);
    if (imageRules) {
      effectiveDescription = effectiveDescription
        ? `${effectiveDescription}\n\n【画像から読み取ったエリアルール】\n${imageRules}`
        : imageRules;
      appendLog(log, 0, "画像ルール変換", `画像から ${imageRules.length} 文字のルールを抽出`);
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
  const truckSpec = vehicleSpecs.find((s) => s.vehicleType === "2t")!;
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light")!;

  const allAssignments: AssignmentResult[] = [];

  // 段階3: 2t割り当て（1バッチ）
  if (truckCandidates.length > 0 && truckCourses.length > 0) {
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
    truckCandidates.forEach((d) => allAssignments.push({
      deliveryId: d.id, courseId: null, reason: "", unassignedReason: "稼働中の2tコースなし",
    }));
    appendLog(log, 3, "2t割り当て", `稼働中の2tコースなしのため ${truckCandidates.length}件すべて未割当`);
  }

  // 段階4: 軽割り当て（バッチ分割）
  if (lightCandidates.length > 0 && lightCourses.length > 0) {
    const t0 = Date.now();
    let batches = 0;
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
      allAssignments.push(...res);
      batches++;
    }
    const lightResults = allAssignments.slice(allAssignments.length - lightCandidates.length);
    const assigned = lightResults.filter((r) => r.courseId).length;
    const unassigned = lightResults.length - assigned;
    appendLog(log, 4, "軽割り当て", `${assigned}件割当 / ${unassigned}件未割当 (${batches}バッチ, ${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
  } else if (lightCandidates.length > 0) {
    lightCandidates.forEach((d) => allAssignments.push({
      deliveryId: d.id, courseId: null, reason: "", unassignedReason: "稼働中の軽コースなし",
    }));
    appendLog(log, 4, "軽割り当て", `稼働中の軽コースなしのため ${lightCandidates.length}件すべて未割当`);
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

  return { assignments: reviewed, assignmentLog: log, capacityWarnings: warnings };
}
```

- [ ] **Step 2: 型エラー確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/lib/gemini.ts
git commit -m "feat: rewrite gemini.ts to 6-stage pipeline with cluster hints"
```

---

### Task 9: API ルート契約変更 + maxDuration 削除

**Files:**
- Modify: `src/app/api/assign/route.ts`

- [ ] **Step 1: route.ts を書き換え**

`src/app/api/assign/route.ts` を以下に置き換え:

```ts
import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Course, AreaRule, VehicleSpec } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription,
  } = body as {
    deliveries: Delivery[];
    courses: Course[];
    activeCourseIds: string[];
    vehicleSpecs: VehicleSpec[];
    areaRules: AreaRule[];
    areaImage: string | null;
    areaDescription: string;
  };

  if (!deliveries || !courses || !activeCourseIds || !vehicleSpecs) {
    return NextResponse.json(
      { error: "deliveries, courses, activeCourseIds, vehicleSpecs are required" },
      { status: 400 }
    );
  }

  const output = await autoAssign(
    deliveries, courses, activeCourseIds, vehicleSpecs,
    areaRules || [], areaImage || null, areaDescription || ""
  );
  console.log("[assign] active courses:", activeCourseIds);
  console.log("[assign] assigned:", output.assignments.filter((a) => a.courseId).length, "/", output.assignments.length);
  console.log("[assign] warnings:", output.capacityWarnings.length);
  return NextResponse.json(output);
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/app/api/assign/route.ts
git commit -m "feat: update /api/assign contract for course-based pipeline, remove maxDuration"
```

---

### Task 10: useAutoAssign フック更新

**Files:**
- Modify: `src/features/assignment/hooks/useAutoAssign.ts`

- [ ] **Step 1: 現状読み取り**

Run: `cat /Users/ken/Desktop/develop/dispatch-app/src/features/assignment/hooks/useAutoAssign.ts`

現状を把握してから書き換える。リクエストには `courses`/`activeCourseIds`/`vehicleSpecs` を送り、レスポンスから `assignmentLog`/`capacityWarnings` を store に格納し、各 delivery に `courseId`/`unassignedReason`/`assignReason`/`colorCode`/`driverName` を反映する。

- [ ] **Step 2: 書き換え**

`src/features/assignment/hooks/useAutoAssign.ts`:

```ts
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { AssignmentLogEntry, CapacityWarning } from "@/shared/types/delivery";

type ApiResponse = {
  assignments: { deliveryId: string; courseId: string | null; reason: string; unassignedReason: string }[];
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
};

export function useAutoAssign() {
  const {
    deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription,
    setDeliveries, setAssignmentLog, setCapacityWarnings, setProcessing, clearProcessing,
  } = useDeliveryStore();

  const run = async () => {
    setProcessing("AIで振り分け中...");
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription,
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      const courseMap = new Map(courses.map((c) => [c.id, c]));
      const assignMap = new Map(data.assignments.map((a) => [a.deliveryId, a]));
      const updated = deliveries.map((d) => {
        const a = assignMap.get(d.id);
        if (!a) return d;
        const course = a.courseId ? courseMap.get(a.courseId) : null;
        return {
          ...d,
          courseId: a.courseId,
          driverName: course?.name ?? null,
          colorCode: course?.color ?? null,
          assignReason: a.reason,
          unassignedReason: a.unassignedReason,
        };
      });
      setDeliveries(updated);
      setAssignmentLog(data.assignmentLog);
      setCapacityWarnings(data.capacityWarnings);
    } finally {
      clearProcessing();
    }
  };

  return { run };
}
```

- [ ] **Step 3: 既存呼び出し箇所への影響を確認**

Run: `Grep "useAutoAssign" src/`
Expected: いくつかのコンポーネントで使用されている。signature が変わっていない（戻り値も `{ run }`）ので呼び出し側は無修正。

- [ ] **Step 4: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: コミット**

```bash
git add src/features/assignment/hooks/useAutoAssign.ts
git commit -m "feat: update useAutoAssign for course-based API and store wiring"
```

---

## Phase 3: UI 更新

### Task 11: 設定画面 — VehicleSpecEditor 新規作成

**Files:**
- Create: `src/features/settings/components/VehicleSpecEditor.tsx`

- [ ] **Step 1: コンポーネント作成**

`src/features/settings/components/VehicleSpecEditor.tsx`:

```tsx
"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { VehicleSpec } from "@/shared/types/delivery";

export function VehicleSpecEditor() {
  const { vehicleSpecs, setVehicleSpecs } = useDeliveryStore();

  const update = (vehicleType: "light" | "2t", field: keyof VehicleSpec, value: number) => {
    setVehicleSpecs(
      vehicleSpecs.map((s) => (s.vehicleType === vehicleType ? { ...s, [field]: value } : s))
    );
  };

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="font-bold text-lg">車両スペック</h2>
      <p className="text-sm text-gray-500">1台あたりの最大運用値を設定します</p>
      {vehicleSpecs.map((s) => (
        <div key={s.vehicleType} className="grid grid-cols-4 gap-2 items-center">
          <div className="font-medium">{s.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</div>
          <label className="text-sm">
            容積(L)
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxVolume}
              onChange={(e) => update(s.vehicleType, "maxVolume", Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            重量(kg)
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxWeight}
              onChange={(e) => update(s.vehicleType, "maxWeight", Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            件数
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={s.maxOrders}
              onChange={(e) => update(s.vehicleType, "maxOrders", Number(e.target.value))}
            />
          </label>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/features/settings/components/VehicleSpecEditor.tsx
git commit -m "feat: add VehicleSpecEditor component"
```

---

### Task 12: 設定画面 — CourseEditor 新規作成

**Files:**
- Create: `src/features/settings/components/CourseEditor.tsx`

- [ ] **Step 1: コンポーネント作成**

`src/features/settings/components/CourseEditor.tsx`:

```tsx
"use client";

import { v4 as uuidv4 } from "uuid";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import type { Course } from "@/shared/types/delivery";

export function CourseEditor() {
  const { courses, setCourses } = useDeliveryStore();

  const update = (id: string, field: keyof Course, value: string) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const add = (vehicleType: "light" | "2t") => {
    const prefix = vehicleType === "2t" ? "truck" : "light";
    const existingNumbers = courses
      .filter((c) => c.vehicleType === vehicleType)
      .map((c) => {
        const m = c.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        return m ? Number(m[1]) : 0;
      });
    const nextNumber = Math.max(0, ...existingNumbers) + 1;
    const newCourse: Course = {
      id: `${prefix}-${nextNumber}-${uuidv4().slice(0, 4)}`,
      name: `${vehicleType === "2t" ? "2t" : "軽"}${nextNumber}`,
      vehicleType,
      color: "#888888",
      defaultRegion: "",
    };
    setCourses([...courses, newCourse]);
  };

  const remove = (id: string) => setCourses(courses.filter((c) => c.id !== id));

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="font-bold text-lg">コース管理</h2>
      <div className="space-y-2">
        {courses.map((c) => (
          <div key={c.id} className="grid grid-cols-[100px_120px_1fr_60px_auto] gap-2 items-center">
            <select
              className="border rounded px-2 py-1"
              value={c.vehicleType}
              onChange={(e) => update(c.id, "vehicleType", e.target.value)}
            >
              <option value="light">軽</option>
              <option value="2t">2t</option>
            </select>
            <input
              className="border rounded px-2 py-1"
              value={c.name}
              onChange={(e) => update(c.id, "name", e.target.value)}
              placeholder="コース名"
            />
            <input
              className="border rounded px-2 py-1"
              value={c.defaultRegion}
              onChange={(e) => update(c.id, "defaultRegion", e.target.value)}
              placeholder="担当エリア（例: 横浜北部・川崎）"
            />
            <input
              type="color"
              className="w-full h-8"
              value={c.color}
              onChange={(e) => update(c.id, "color", e.target.value)}
            />
            <button className="text-red-600 text-sm" onClick={() => remove(c.id)} type="button">削除</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="border rounded px-3 py-1 text-sm" onClick={() => add("light")} type="button">+ 軽を追加</button>
        <button className="border rounded px-3 py-1 text-sm" onClick={() => add("2t")} type="button">+ 2tを追加</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/features/settings/components/CourseEditor.tsx
git commit -m "feat: add CourseEditor component"
```

---

### Task 13: 既存 AreaRuleEditor を courseId ベースに書き換え

**Files:**
- Modify: `src/features/settings/components/AreaRuleEditor.tsx`

- [ ] **Step 1: 現状読み取り**

Run: `cat /Users/ken/Desktop/develop/dispatch-app/src/features/settings/components/AreaRuleEditor.tsx`

まずファイルを読んで既存のエリア画像/説明入力と AreaRule テーブルを把握する。

- [ ] **Step 2: 書き換え方針**

- ドライバー編集部分を削除（`CourseEditor` に移管済）
- `AreaRule` 入力で `driverName` + `vehicleType` のドロップダウンを **単一の `courseId` 選択** に変更
- エリア画像アップロード・テキスト説明入力は維持
- 既存レイアウトを尊重しつつコンポーネント名は `AreaRuleEditor` のまま

- [ ] **Step 3: 実装**

`AreaRule` 行のドロップダウン部分を:

```tsx
<select
  value={rule.courseId ?? ""}
  onChange={(e) => updateRule(rule.id, { courseId: e.target.value })}
  className="border rounded px-2 py-1"
>
  <option value="">コースを選択</option>
  {courses.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name} ({c.vehicleType === "2t" ? "2t" : "軽"})
    </option>
  ))}
</select>
```

`driverName` / `vehicleType` の入力 UI・関連ロジック・対応する state 操作を削除。`updateRule` で `courseId` のみ更新。新規追加時は `{ id: uuidv4(), region: "", courseId: "", driverName: "", vehicleType: "light" }`（互換保持のため旧フィールドは空文字で初期化）。

- [ ] **Step 4: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: コミット**

```bash
git add src/features/settings/components/AreaRuleEditor.tsx
git commit -m "feat: switch AreaRuleEditor to courseId-based dropdown"
```

---

### Task 14: 設定ページ統合

**Files:**
- Modify: `src/app/(routes)/settings/page.tsx`

- [ ] **Step 1: 現状読み取り**

Run: `cat 'src/app/(routes)/settings/page.tsx'`

- [ ] **Step 2: 3カード構成に書き換え**

```tsx
import { VehicleSpecEditor } from "@/features/settings/components/VehicleSpecEditor";
import { CourseEditor } from "@/features/settings/components/CourseEditor";
import { AreaRuleEditor } from "@/features/settings/components/AreaRuleEditor";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">設定</h1>
      <VehicleSpecEditor />
      <CourseEditor />
      <AreaRuleEditor />
    </div>
  );
}
```

既存の import やレイアウトがある場合は、その構造を維持しつつ 3 コンポーネントを配置する。

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: コミット**

```bash
git add "src/app/(routes)/settings/page.tsx"
git commit -m "feat: split settings page into VehicleSpec/Course/AreaRule cards"
```

---

### Task 15: 稼働台数入力ダイアログ（アップロードページ統合）

**Files:**
- Create: `src/features/upload/components/CapacityInputDialog.tsx`
- Modify: `src/app/(routes)/upload/page.tsx`

- [ ] **Step 1: CapacityInputDialog 作成**

`src/features/upload/components/CapacityInputDialog.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { getTruckThreshold } from "@/lib/capacity";

type Props = {
  onConfirm: () => void;
};

export function CapacityInputDialog({ onConfirm }: Props) {
  const { deliveries, courses, vehicleSpecs, activeCourseIds, setActiveCourseIds } = useDeliveryStore();

  const summary = useMemo(() => {
    const threshold = getTruckThreshold(vehicleSpecs);
    const totalVolume = deliveries.reduce((s, d) => s + d.volume, 0);
    const totalWeight = deliveries.reduce((s, d) => s + d.actualWeight, 0);
    const truckCount = deliveries.filter((d) => d.volume >= threshold).length;
    const lightCount = deliveries.length - truckCount;
    return { totalVolume, totalWeight, truckCount, lightCount, threshold };
  }, [deliveries, vehicleSpecs]);

  const [selected, setSelected] = useState<Set<string>>(new Set(activeCourseIds));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const confirm = () => {
    setActiveCourseIds(Array.from(selected));
    onConfirm();
  };

  const activeLight = courses.filter((c) => c.vehicleType === "light" && selected.has(c.id)).length;
  const activeTruck = courses.filter((c) => c.vehicleType === "2t" && selected.has(c.id)).length;
  const lightSpec = vehicleSpecs.find((s) => s.vehicleType === "light");
  const truckSpec = vehicleSpecs.find((s) => s.vehicleType === "2t");
  const capacityOk =
    activeLight * (lightSpec?.maxOrders ?? 0) + activeTruck * (truckSpec?.maxOrders ?? 0) >= deliveries.length;

  return (
    <div className="space-y-4 p-4 border rounded">
      <h2 className="font-bold text-lg">本日の稼働台数を入力</h2>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>件数 <span className="font-mono">{deliveries.length}</span></div>
        <div>容積合計 <span className="font-mono">{summary.totalVolume}L</span></div>
        <div>重量合計 <span className="font-mono">{summary.totalWeight}kg</span></div>
        <div>大口(≥{summary.threshold}L)/軽 <span className="font-mono">{summary.truckCount}/{summary.lightCount}</span></div>
      </div>
      <div>
        <h3 className="font-medium mb-2">稼働するコースを選択</h3>
        <div className="grid grid-cols-3 gap-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 border rounded px-3 py-2">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              <span>{c.name}</span>
              <span className="text-xs text-gray-500">({c.vehicleType === "2t" ? "2t" : "軽"})</span>
            </label>
          ))}
        </div>
      </div>
      <div className="text-sm">
        容量目安: 軽{activeLight}台 × {lightSpec?.maxOrders}件 + 2t{activeTruck}台 × {truckSpec?.maxOrders}件 = {activeLight * (lightSpec?.maxOrders ?? 0) + activeTruck * (truckSpec?.maxOrders ?? 0)}件
        {!capacityOk && <span className="text-red-600 ml-2">⚠ 件数上限合計が配送件数を下回っています</span>}
      </div>
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        onClick={confirm}
        disabled={selected.size === 0}
        type="button"
      >
        この構成で振り分け実行
      </button>
    </div>
  );
}
```

- [ ] **Step 2: upload/page.tsx を修正**

`src/app/(routes)/upload/page.tsx` を読み、Excel パース後のプレビュー表示直後に `CapacityInputDialog` を差し込む。`onConfirm` で ジオコーディング→振り分け実行フローに接続する（既存の自動振り分けトリガーを差し替える）。

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: コミット**

```bash
git add src/features/upload/components/CapacityInputDialog.tsx "src/app/(routes)/upload/page.tsx"
git commit -m "feat: add CapacityInputDialog integrated into upload preview"
```

---

### Task 16: CourseFilterBar 新規（DriverFilterBar をコピー元に）

**Files:**
- Create: `src/features/assignment/components/CourseFilterBar.tsx`

- [ ] **Step 1: DriverFilterBar を読み、CourseFilterBar として作り直す**

Run: `cat src/features/assignment/components/DriverFilterBar.tsx` で既存ロジックを確認。`driverName` 参照を `courseId`、`drivers` を `courses`、`toggleDriverFilter` を `toggleCourseFilter`、`driverFilter` を `courseFilter` に置換した新ファイルを作成する。コース名表示は `course.name`、配色は `course.color`、内部参照キーは `course.id`。

既存 `DriverFilterBar.tsx` はこの時点では残す（Phase 4 で削除）。

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: コミット**

```bash
git add src/features/assignment/components/CourseFilterBar.tsx
git commit -m "feat: add CourseFilterBar (courseId-based)"
```

---

### Task 17: CourseSummary 新規（DriverSummary をコピー元に、容量表示追加）

**Files:**
- Create: `src/features/assignment/components/CourseSummary.tsx`

- [ ] **Step 1: 作成**

DriverSummary を参考に CourseSummary を作る。各コースごとに以下を表示:

- コース名・色
- 割当件数 / `maxOrders`
- 合計容積 / `maxVolume` (L)
- 合計重量 / `maxWeight` (kg)
- 上限超過分は赤字

```tsx
"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function CourseSummary() {
  const { deliveries, courses, vehicleSpecs, activeCourseIds } = useDeliveryStore();
  return (
    <div className="space-y-2">
      {courses.filter((c) => activeCourseIds.includes(c.id)).map((c) => {
        const spec = vehicleSpecs.find((s) => s.vehicleType === c.vehicleType);
        const assigned = deliveries.filter((d) => d.courseId === c.id);
        const vol = assigned.reduce((s, d) => s + d.volume, 0);
        const w = assigned.reduce((s, d) => s + d.actualWeight, 0);
        const cnt = assigned.length;
        const over = (a: number, b: number) => a > b ? "text-red-600 font-bold" : "";
        return (
          <div key={c.id} className="flex items-center gap-3 border rounded px-3 py-2">
            <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
            <span className="font-medium w-16">{c.name}</span>
            <span className={`text-sm ${over(cnt, spec?.maxOrders ?? Infinity)}`}>件数 {cnt}/{spec?.maxOrders}</span>
            <span className={`text-sm ${over(vol, spec?.maxVolume ?? Infinity)}`}>容積 {vol}/{spec?.maxVolume}L</span>
            <span className={`text-sm ${over(w, spec?.maxWeight ?? Infinity)}`}>重量 {w}/{spec?.maxWeight}kg</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/features/assignment/components/CourseSummary.tsx
git commit -m "feat: add CourseSummary with capacity display"
```

---

### Task 18: AssignmentLogPanel / CapacityWarningPanel / RerunButton

**Files:**
- Create: `src/features/assignment/components/AssignmentLogPanel.tsx`
- Create: `src/features/assignment/components/CapacityWarningPanel.tsx`
- Create: `src/features/assignment/components/RerunButton.tsx`

- [ ] **Step 1: AssignmentLogPanel 作成**

```tsx
"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function AssignmentLogPanel() {
  const { assignmentLog } = useDeliveryStore();
  const copy = () => {
    const text = assignmentLog.map((e) => `[段階${e.step}: ${e.title}] ${e.message}`).join("\n");
    navigator.clipboard.writeText(text);
  };
  if (assignmentLog.length === 0) return null;
  return (
    <section className="rounded border p-3 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm">振り分けログ</h3>
        <button onClick={copy} type="button" className="text-xs border rounded px-2 py-0.5">コピー</button>
      </div>
      <ul className="text-xs space-y-1 font-mono">
        {assignmentLog.map((e, i) => (
          <li key={i}><span className="text-gray-500">[段階{e.step}: {e.title}]</span> {e.message}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: CapacityWarningPanel 作成**

```tsx
"use client";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function CapacityWarningPanel() {
  const { capacityWarnings, setCourseFilter } = useDeliveryStore();
  if (capacityWarnings.length === 0) return null;
  return (
    <section className="rounded border border-amber-400 bg-amber-50 p-3 space-y-2">
      <h3 className="font-bold text-sm text-amber-800">⚠ 上限超過 ({capacityWarnings.length}件)</h3>
      <ul className="text-xs space-y-1">
        {capacityWarnings.map((w, i) => (
          <li key={i}>
            <button
              onClick={() => setCourseFilter(new Set([w.courseId]))}
              className="underline text-amber-900 text-left"
              type="button"
            >
              {w.message}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">超過分は手動で調整してください（振り分けは変更されません）</p>
    </section>
  );
}
```

- [ ] **Step 3: RerunButton 作成**

```tsx
"use client";
import { useAutoAssign } from "@/features/assignment/hooks/useAutoAssign";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function RerunButton() {
  const { run } = useAutoAssign();
  const { isProcessing, clearAssignmentResults } = useDeliveryStore();
  const rerun = async () => {
    clearAssignmentResults();
    await run();
  };
  return (
    <button
      onClick={rerun}
      disabled={isProcessing}
      type="button"
      className="border rounded px-3 py-1 text-sm disabled:opacity-50"
    >
      {isProcessing ? "実行中..." : "振り分けをやり直す"}
    </button>
  );
}
```

- [ ] **Step 4: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: コミット**

```bash
git add src/features/assignment/components/AssignmentLogPanel.tsx src/features/assignment/components/CapacityWarningPanel.tsx src/features/assignment/components/RerunButton.tsx
git commit -m "feat: add AssignmentLog/CapacityWarning/Rerun panels"
```

---

### Task 19: 地図ページに新パネル配置、Course 参照に切替

**Files:**
- Modify: `src/app/(routes)/map/page.tsx`
- Modify: `src/features/map/components/DeliveryListPanel.tsx`
- Modify: `src/features/map/components/DeliveryPin.tsx`
- Modify: `src/features/map/components/DeliveryMap.tsx`
- Modify: `src/features/map/hooks/useMapInteraction.ts`
- Modify: `src/features/map/components/PinDetailPanel.tsx`

- [ ] **Step 1: 各ファイルを順に読んでから更新**

Run: 以下を個別に実行してファイルの現状を確認:
- `cat 'src/app/(routes)/map/page.tsx'`
- `cat src/features/map/components/PinDetailPanel.tsx`
- `cat src/features/map/components/DeliveryListPanel.tsx`
- `cat src/features/map/components/DeliveryPin.tsx`
- `cat src/features/map/components/DeliveryMap.tsx`
- `cat src/features/map/hooks/useMapInteraction.ts`

- [ ] **Step 2: map/page.tsx に新パネル配置**

`DriverFilterBar` → `CourseFilterBar` に置換。`DriverSummary` → `CourseSummary` に置換。新しく `AssignmentLogPanel` / `CapacityWarningPanel` / `RerunButton` をサイドバーに配置。

- [ ] **Step 3: PinDetailPanel を courseId ドロップダウン + slip 内訳に変更**

既存のドライバードロップダウンを `courseId` 選択に変更。`updateCourseAssignment(id, courseId)` を呼ぶ。`selectedDelivery.slips` を伝票内訳テーブルとして表示:

```tsx
{delivery.slips && delivery.slips.length > 0 && (
  <table className="text-xs w-full mt-2">
    <thead><tr><th>伝票No</th><th>個口</th><th>容積</th><th>重量</th></tr></thead>
    <tbody>
      {delivery.slips.map((s) => (
        <tr key={s.slipNumber}>
          <td>{s.slipNumber}</td>
          <td>{s.packageCount}</td>
          <td>{s.volume}</td>
          <td>{s.actualWeight}</td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

- [ ] **Step 4: DeliveryListPanel に未割当グループと `unassignedReason` 表示を追加**

`deliveries.filter((d) => d.courseId === null && !d.isUndelivered)` を最上部に固定表示。各行に `d.unassignedReason` を小さく表示。

- [ ] **Step 5: DeliveryPin を courseId / colorCode null で灰色表示**

`colorCode === null` のとき `#999999` を使用、透過ボーダー等で「未割当」が視覚的にわかる表現。

- [ ] **Step 6: DeliveryMap / useMapInteraction を courseFilter に切替**

`driverFilter` 参照を `courseFilter` に置換。フィルタ判定も `delivery.courseId` ベースに変更。

- [ ] **Step 7: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: コミット**

```bash
git add "src/app/(routes)/map/page.tsx" src/features/map/
git commit -m "feat: update map page with course filter, log/warning panels, slip breakdown"
```

---

### Task 20: PDF レポートを Course 参照に切替

**Files:**
- Modify: `src/features/pdf/components/DeliveryReport.tsx`
- Modify: `src/features/pdf/hooks/usePdfGenerate.ts`

- [ ] **Step 1: 現状読み取り**

Run: `cat src/features/pdf/components/DeliveryReport.tsx src/features/pdf/hooks/usePdfGenerate.ts`

- [ ] **Step 2: 更新方針**

- `driverName` 参照をすべて `course.name` ルックアップに変更（`courses.find((c) => c.id === delivery.courseId)?.name`）
- 色参照は `course?.color` を使用（旧 `colorCode` は残してもよいが course から引くのが正）
- `capacityWarnings` が store に存在する場合、先頭ページに警告サマリ (`⚠ 上限超過コースあり`) を追加
- `usePdfGenerate.ts` の引数を `courses` ベースに

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: コミット**

```bash
git add src/features/pdf/
git commit -m "feat: switch PDF report to course references and add warning summary"
```

---

### Task 21: 共有ビュー（SharedMap / view route）を Course 参照に切替

**Files:**
- Modify: `src/features/map/components/SharedMap.tsx`
- Modify: `src/app/(routes)/view/[sessionId]/page.tsx`

- [ ] **Step 1: 現状読み取り**

Run: `cat src/features/map/components/SharedMap.tsx 'src/app/(routes)/view/[sessionId]/page.tsx'`

- [ ] **Step 2: 更新**

`driverName` / `drivers` 参照を `courseId` / `courses` に切替。フィルタも `courseFilter` ベース。

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: コミット**

```bash
git add src/features/map/components/SharedMap.tsx "src/app/(routes)/view/[sessionId]/page.tsx"
git commit -m "feat: update shared view to course references"
```

---

## Phase 4: 旧型・旧フィールドの削除（contract）

### Task 22: 全ファイルから driverName 参照を courseId に置換

**Files:**
- Modify: 全ソースファイル（`grep` で抽出）

- [ ] **Step 1: 残存箇所を抽出**

Run (Grep tool で実行):
```
pattern: "driverName|driverFilter|toggleDriverFilter|bulkAssignDriver|updateDriverAssignment|setDrivers|DEFAULT_DRIVERS|: Driver\\b|Driver\\["
output_mode: "files_with_matches"
glob: "**/*.{ts,tsx}"
```

Phase 1-3 で残しておいた互換コードと、`gemini.ts` 内の旧 buildPrompt は削除済みのはず。残存箇所を一つずつ確認:

- store の `bulkAssignDriver` / `updateDriverAssignment` / `setDrivers` / `toggleDriverFilter` / `setDriverFilter` / `drivers` / `driverFilter` / `DEFAULT_DRIVERS` の使用箇所を検出
- 利用側がなければ store からも削除可能

- [ ] **Step 2: 利用側を courseId 系メソッドに移行**

`useExcelParser` の `driverName: null` 初期化を削除（型で `courseId` のみ管理）。`PinDetailPanel` の旧 props を削除。`DriverFilterBar.tsx` を削除（`CourseFilterBar` が代替）。`DriverSummary.tsx` を削除。

- [ ] **Step 3: store から旧フィールド削除**

`src/shared/store/deliveryStore.ts` から以下を削除:
- `drivers`, `driverFilter` フィールド
- `setDrivers`, `setDriverFilter`, `toggleDriverFilter`, `updateDriverAssignment`, `bulkAssignDriver`
- `Driver` / `DEFAULT_DRIVERS` import

- [ ] **Step 4: 型定義から削除**

`src/shared/types/delivery.ts` から:
- `Driver` 型を削除
- `DEFAULT_DRIVERS` を削除
- `Delivery.driverName` を削除（`courseId` のみ残す）
- `AreaRule.driverName`, `AreaRule.vehicleType` を削除（`courseId` のみ）
- `Delivery.rawAddress`, `slips`, `courseId`, `unassignedReason` を `?` から必須に格上げ

- [ ] **Step 5: 旧コンポーネントファイル削除**

```bash
git rm src/features/assignment/components/DriverFilterBar.tsx
git rm src/features/assignment/components/DriverSummary.tsx
```

- [ ] **Step 6: ビルド・テスト確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit && npm test`
Expected: 0 errors, all tests pass

修正が必要な箇所が出た場合は、grep で参照を追跡して順次修正。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "refactor: remove Driver type, driverName fields, legacy components"
```

---

### Task 23: モックデータ更新

**Files:**
- Modify: `src/test/mocks/delivery.ts`

- [ ] **Step 1: 現状読み取り**

Run: `cat src/test/mocks/delivery.ts`

- [ ] **Step 2: 新型に追従**

`driverName` を持つモックを `courseId` ベースに変更。`slips`, `rawAddress`, `unassignedReason` を含める。`Course` / `VehicleSpec` のモック定数を追加（`mockCourses`, `mockVehicleSpecs`）。

- [ ] **Step 3: テスト実行**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npm test`
Expected: all tests pass

- [ ] **Step 4: コミット**

```bash
git add src/test/mocks/delivery.ts
git commit -m "test: update delivery mocks for course-based types"
```

---

### Task 24: パイプライン統合テスト

**Files:**
- Create: `src/lib/__tests__/gemini.integration.test.ts`

- [ ] **Step 1: モック AI を使った統合テスト作成**

`src/lib/__tests__/gemini.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn(() => ({
      getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn(async (prompt: unknown) => ({
          response: {
            text: () => {
              const text = typeof prompt === "string" ? prompt : "";
              if (text.includes("品質レビュアー")) {
                return JSON.stringify({ corrections: [] });
              }
              if (text.includes("配送ルート振り分け")) {
                const idMatch = text.match(/"id":"([^"]+)"/g) ?? [];
                const ids = idMatch.map((m) => m.match(/"id":"([^"]+)"/)![1]);
                const courseIdMatch = text.match(/^- (light-\d+|truck-\d+)/m);
                const courseId = courseIdMatch ? courseIdMatch[1] : "light-1";
                return JSON.stringify({
                  assignments: ids.map((id) => ({ deliveryId: id, courseId, reason: "mock", unassignedReason: "" })),
                });
              }
              return "{}";
            },
          },
        })),
      })),
    })),
  };
});

import { autoAssign } from "../gemini";
import type { Delivery, Course, VehicleSpec, AreaRule } from "@/shared/types/delivery";

describe("autoAssign integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces log entries for each stage", async () => {
    const courses: Course[] = [
      { id: "light-1", name: "軽1", vehicleType: "light", color: "#000", defaultRegion: "" },
      { id: "truck-1", name: "2t1", vehicleType: "2t", color: "#000", defaultRegion: "" },
    ];
    const specs: VehicleSpec[] = [
      { vehicleType: "light", maxVolume: 4500, maxWeight: 1050, maxOrders: 25 },
      { vehicleType: "2t", maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
    ];
    const deliveries: Delivery[] = [
      makeD("a", 100, 50, 35.4, 139.5),
      makeD("b", 2000, 200, 35.4001, 139.5001),
    ];
    const rules: AreaRule[] = [];
    const result = await autoAssign(deliveries, courses, ["light-1", "truck-1"], specs, rules, null, "");
    expect(result.assignmentLog.length).toBeGreaterThanOrEqual(5);
    expect(result.assignmentLog.some((e) => e.title === "大口抽出")).toBe(true);
    expect(result.assignmentLog.some((e) => e.title === "クラスタリング")).toBe(true);
    expect(result.assignmentLog.some((e) => e.title === "容量チェック")).toBe(true);
    expect(result.assignments).toHaveLength(2);
  });
});

function makeD(id: string, volume: number, weight: number, lat: number, lng: number): Delivery {
  return {
    id, factoryName: "", carrierCode: 0, carrierName: "",
    destinationCode: 0, destinationName: "",
    packageCount: 0, quantity: 0, caseCount: 0, assortQuantity: 0,
    actualWeight: weight, volume, addressCode: 0, address: "",
    rawAddress: "", slips: [], deliveryDate: "", slipNumber: 0, shippingNumber: 0,
    shippingCategory: "", lat, lng, courseId: null, colorCode: null,
    isUndelivered: false, memo: "", assignReason: "", unassignedReason: "",
    geocodeStatus: "success",
  };
}
```

- [ ] **Step 2: テスト実行**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx vitest run src/lib/__tests__/gemini.integration.test.ts`
Expected: 1 passed

- [ ] **Step 3: コミット**

```bash
git add src/lib/__tests__/gemini.integration.test.ts
git commit -m "test: add gemini autoAssign integration test with mocked AI"
```

---

## Phase 5: Railway 移行

### Task 25: package.json に engines 追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: engines フィールドを追加**

`package.json` の `private: true` の下に追加:

```json
  "engines": {
    "node": "20.x"
  },
```

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npm run build`
Expected: build success

- [ ] **Step 3: コミット**

```bash
git add package.json
git commit -m "chore: pin Node 20.x in package.json engines for Railway"
```

---

### Task 26: 画像ルールキャッシュ実装

**Files:**
- Modify: `src/lib/gemini.ts`
- Create: `src/lib/__tests__/gemini.cache.test.ts`

- [ ] **Step 1: ハッシュ関数とキャッシュ層を gemini.ts に追加**

クライアント側で `localStorage` を使うため、キャッシュは `useAutoAssign` 側でラップするほうが筋が良い。代替として、`gemini.ts` の `extractAreaRulesFromImage` をキャッシュ可能にし、`useAutoAssign` 側で事前計算した `effectiveDescription` を `/api/assign` に送る案を採用する。

実装方針を以下のように変更:

1. `useAutoAssign` 内で `areaImage` がある場合、ブラウザ側で SHA-256 を計算
2. `localStorage` から `area-rules-${imageHash}-${coursesHash}` を引く
3. なければサーバ API `/api/extract-area-rules` を呼び（または既存 `/api/assign` 経由）、結果を `localStorage` に保存
4. キャッシュヒット時は `areaImage` を送らず、効果を反映済みの `areaDescription` を送る

シンプル化のため、`/api/assign` の入力に `prefetchedImageRules` フィールドを追加し、与えられればサーバ側の `extractAreaRulesFromImage` をスキップする方式にする。

- [ ] **Step 2: 詳細実装**

`src/lib/imageCache.ts` を新規作成:

```ts
async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedImageRules(
  areaImage: string,
  courses: Array<{ id: string; name: string }>
): Promise<{ key: string; cached: string | null }> {
  const imageHash = await sha256(areaImage);
  const coursesHash = await sha256(JSON.stringify(courses.map((c) => `${c.id}:${c.name}`)));
  const key = `area-rules-${imageHash}-${coursesHash}`;
  const cached = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  return { key, cached };
}

export function setCachedImageRules(key: string, value: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}
```

`useAutoAssign.ts` 内で:

```ts
import { getCachedImageRules, setCachedImageRules } from "@/lib/imageCache";

// run 内:
let prefetchedImageRules: string | null = null;
let imageToSend = areaImage;
if (areaImage) {
  const { key, cached } = await getCachedImageRules(areaImage, courses);
  if (cached) {
    prefetchedImageRules = cached;
    imageToSend = null;  // サーバに送らない
  } else {
    // サーバが返した rules をキャッシュに保存するため、レスポンスから取得する仕組みが必要
    // → 段階0 のログメッセージ末尾に "rules: <text>" を含めるか、別途レスポンスに付加する
  }
}
```

- [ ] **Step 3: API レスポンスにキャッシュ書き込み用の `imageRulesText` を追加**

`gemini.ts` の `AutoAssignOutput` に `imageRulesText: string | null` を追加し、段階0で取得したテキストを返却する。`route.ts` でそのまま透過。`useAutoAssign` で値があれば `setCachedImageRules(key, imageRulesText)`。

`autoAssign` のシグネチャに `prefetchedImageRules: string | null` を追加し、与えられた場合は `extractAreaRulesFromImage` を呼ばない。

- [ ] **Step 4: キャッシュキー単体テスト**

```ts
import { describe, it, expect, vi } from "vitest";
import { getCachedImageRules } from "../imageCache";

describe("getCachedImageRules", () => {
  it("returns null when not cached", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    const { cached } = await getCachedImageRules("data:image/png;base64,xxx", [{ id: "light-1", name: "軽1" }]);
    expect(cached).toBeNull();
  });

  it("changes key when courses change", async () => {
    const a = await getCachedImageRules("data:image/png;base64,xxx", [{ id: "a", name: "A" }]);
    const b = await getCachedImageRules("data:image/png;base64,xxx", [{ id: "b", name: "B" }]);
    expect(a.key).not.toBe(b.key);
  });
});
```

- [ ] **Step 5: ビルド・テスト確認**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit && npm test`
Expected: all pass

- [ ] **Step 6: コミット**

```bash
git add src/lib/imageCache.ts src/lib/__tests__/gemini.cache.test.ts src/lib/gemini.ts src/app/api/assign/route.ts src/features/assignment/hooks/useAutoAssign.ts
git commit -m "feat: cache image-derived area rules with image+courses hash key"
```

---

### Task 27: Railway 移行ドキュメント

**Files:**
- Create: `docs/railway-deployment.md`

- [ ] **Step 1: 手順書を作成**

`docs/railway-deployment.md`:

```markdown
# Railway デプロイ手順

## 前提
- Node.js 20.x（package.json の `engines` で指定）
- ビルダー: Nixpacks（自動検出）
- 環境変数: `GEMINI_API_KEY`（必須）、`DBSCAN_EPS_KM`（任意、デフォルト5、サーバー専用）、`DBSCAN_MIN_PTS`（任意、デフォルト2、サーバー専用）

## 移行手順
1. Railway アカウント / プロジェクトを作成
2. GitHub リポジトリを Railway に接続（`main` ブランチ）
3. Variables に `GEMINI_API_KEY` を設定（Vercel から手動コピー）
4. 必要なら DBSCAN 関連の環境変数を追加
5. 初回デプロイ実行 → Railway が自動で Nixpacks ビルド・起動
6. デプロイ後の URL で動作確認:
   - `/upload` で Excel をアップロード
   - 振り分け実行
   - ログとエラーを Railway ダッシュボードで確認
7. 2-3日安定稼働確認
8. Vercel プロジェクト削除

## ロールバック手順
Railway で問題が発生した場合:
1. 移行後 2-3日は Vercel と並行稼働
2. Vercel ダッシュボードから環境変数をエクスポートしてバックアップ
3. ロールバック時:
   - Railway デプロイを停止または環境変数を変更
   - Vercel デプロイを再有効化
4. 必要に応じてローカル `.env.local` の値を Vercel に再設定

## 注意点
- `maxDuration` は Railway では無視される（コードからは削除済）
- Route Handler は Next.js 16 の Node.js ランタイム（デフォルト）で動作
- ビルド失敗時は `package.json` の `engines.node` バージョンを確認
```

- [ ] **Step 2: コミット**

```bash
git add docs/railway-deployment.md
git commit -m "docs: add Railway deployment guide and rollback procedure"
```

---

## Phase 6: 全体検証

### Task 28: 全テスト実行 + 型チェック + ビルド

- [ ] **Step 1: 完全な検証スイート**

Run:
```
cd /Users/ken/Desktop/develop/dispatch-app && npx tsc --noEmit && npm test && npm run lint && npm run build
```

Expected: 全て成功

- [ ] **Step 2: 失敗したら原因を特定して修正**

各失敗を順に:
- 型エラー: 該当ファイルを修正
- テスト失敗: テスト or 実装を修正
- lint 警告: 該当箇所を修正
- ビルド失敗: ログを精査

- [ ] **Step 3: 修正がある場合コミット**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```

---

### Task 29: 戸塚0417 データでの手動 E2E

- [ ] **Step 1: 開発サーバ起動**

Run: `cd /Users/ken/Desktop/develop/dispatch-app && npm run dev` (in background)

- [ ] **Step 2: 手動シナリオ実行**

ブラウザで:
1. `/settings` で軽4台、2t2台のデフォルト構成を確認、車両スペック確認
2. `/upload` で `/Users/ken/Desktop/戸塚0417 (1).xlsx` をアップロード
3. プレビューで件数 152 / 容積 65,483L / 重量 15,702kg / 大口14件・軽138件 を確認
4. 稼働コースを全て選択 → 振り分け実行
5. 地図で振り分け結果を確認
6. ログパネルで段階1〜6 のログを確認
7. 警告パネルで上限超過があれば内容を確認
8. PinDetail を開いて伝票内訳テーブル表示を確認
9. PDF 出力でコース名表示を確認
10. やり直しボタンで再実行できることを確認

- [ ] **Step 3: 観察結果を docs に記録**

`docs/superpowers/specs/2026-04-18-assignment-precision-improvement-design.md` の §11 末尾、または別途 `docs/2026-04-18-validation-notes.md` に観察結果（未割当件数、ログ内容、警告内容、AI 呼び出し回数）を記録。

- [ ] **Step 4: コミット**

```bash
git add docs/
git commit -m "docs: record manual E2E validation notes for totsuka-0417"
```

---

## 完了基準

- [ ] 全テストが通過
- [ ] `npx tsc --noEmit` が 0 エラー
- [ ] `npm run build` 成功
- [ ] 戸塚0417 で 277行→152件 集約・振り分け実行が完走
- [ ] ログ・警告・伝票内訳がUIで表示される
- [ ] Railway デプロイ手順書がコミット済
- [ ] 旧 `Driver` 型・`driverName` フィールドがコードに残存しない（`grep` で確認）

---

## 実行ハンドオフ

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-assignment-precision-improvement.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

