# 配送先マッピングシステム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Excelの配送先リストをアップロードし、地図上にプロット、Gemini Flashで自動振り分け、ドライバー別PDF出力ができるプロトタイプWebアプリを構築する。

**Architecture:** Next.js 15 App Router でフロントエンド・バックエンドを統一。featureアーキテクチャでupload/map/assignment/pdf/settingsに分離。状態管理はZustand、地図はreact-leaflet、外部APIは国土地理院（ジオコーディング）とGemini Flash（自動振り分け）。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, react-leaflet, xlsx, @react-pdf/renderer, @google/generative-ai

**Spec:** `docs/superpowers/specs/2026-03-19-delivery-mapping-system-design.md`

---

## File Map

### Shared / Core
| File | Responsibility |
|------|---------------|
| `src/shared/types/delivery.ts` | Delivery, Driver, AreaRule 型定義 |
| `src/shared/store/deliveryStore.ts` | Zustand store（全アプリ状態管理） |
| `src/lib/geocoding.ts` | 国土地理院API呼び出し（並列制御・キャッシュ・リトライ） |
| `src/lib/gemini.ts` | Gemini Flash呼び出し（プロンプト構築・レスポンス検証） |

### Feature: Upload
| File | Responsibility |
|------|---------------|
| `src/features/upload/hooks/useExcelParser.ts` | Excelファイル解析 → Delivery[]変換 |
| `src/features/upload/components/UploadDropzone.tsx` | ドラッグ&ドロップUI + ファイル選択 |
| `src/app/(routes)/upload/page.tsx` | アップロード画面ページ |

### Feature: Map
| File | Responsibility |
|------|---------------|
| `src/features/map/components/DeliveryMap.tsx` | Leaflet地図コンテナ（dynamic import） |
| `src/features/map/components/DeliveryPin.tsx` | 配送先ピン（色・サイズ分け） |
| `src/features/map/components/PinDetailPanel.tsx` | ピン詳細サイドパネル（編集機能含む） |
| `src/features/map/components/GeocodingErrorList.tsx` | ジオコーディング失敗リスト |
| `src/features/map/components/DeliveryListPanel.tsx` | 配送先一覧リスト |
| `src/features/map/hooks/useMapInteraction.ts` | 地図パン・ズーム操作（リスト→地図連動） |
| `src/app/(routes)/map/page.tsx` | 地図画面ページ |

### Feature: Assignment
| File | Responsibility |
|------|---------------|
| `src/features/assignment/components/DriverFilterBar.tsx` | ドライバー別フィルターボタン群 |
| `src/features/assignment/hooks/useAutoAssign.ts` | 自動振り分けフロー制御 |
| `src/app/api/assign/route.ts` | Gemini Flash API Route |
| `src/app/api/geocode/route.ts` | 国土地理院 API Route |

### Feature: PDF
| File | Responsibility |
|------|---------------|
| `src/features/pdf/components/DeliveryReport.tsx` | PDF文書レイアウト定義 |
| `src/features/pdf/hooks/usePdfGenerate.ts` | PDF生成・ダウンロードフロー |

### Feature: Settings
| File | Responsibility |
|------|---------------|
| `src/features/settings/components/AreaRuleEditor.tsx` | ドライバー・エリアルール編集UI |
| `src/app/(routes)/settings/page.tsx` | 設定画面ページ |

### Feature: Share
| File | Responsibility |
|------|---------------|
| `src/app/api/share/route.ts` | 共有データの保存・取得API |
| `src/app/(routes)/view/[sessionId]/page.tsx` | ドライバー参照ビュー |

### App Shell
| File | Responsibility |
|------|---------------|
| `src/app/layout.tsx` | ルートレイアウト |
| `src/app/page.tsx` | ランディング（→ upload誘導） |

---

## Task 1: プロジェクト初期セットアップ

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.local.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Next.js プロジェクト作成**

```bash
cd /Users/ken/Desktop/develop/dispatch-app
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select: No to Turbopack (安定性優先)

- [ ] **Step 2: shadcn/ui 初期化**

```bash
npx shadcn@latest init
```

Default style, Zinc color, CSS variables: yes

- [ ] **Step 3: 依存パッケージインストール**

```bash
npm install zustand xlsx @react-pdf/renderer @google/generative-ai react-leaflet leaflet uuid
npm install -D @types/leaflet @types/uuid
```

- [ ] **Step 4: shadcn/ui コンポーネント追加**

```bash
npx shadcn@latest add button card input label select switch dialog table badge dropdown-menu separator scroll-area toast
```

- [ ] **Step 5: 環境変数テンプレート作成**

Create `.env.local.example`:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Create `.env.local`:
```
GEMINI_API_KEY=
```

- [ ] **Step 6: .gitignore 確認・修正**

`.env.local` が含まれていることを確認。

- [ ] **Step 7: ランディングページ作成**

`src/app/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          配送先マッピングシステム
        </h1>
        <p className="text-gray-600 text-lg">
          Excelの配送先リストをアップロードして、地図上で配車管理ができます
        </p>
        <Link href="/upload">
          <Button size="lg" className="text-lg px-8 py-6">
            はじめる
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: layout.tsx に日本語フォント設定**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "配送先マッピングシステム",
  description: "配送先の地図プロット・配車管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 9: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、ランディングページが表示されることを確認。

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "feat: initialize Next.js project with shadcn/ui and dependencies"
```

---

## Task 2: 共有型定義 & Zustand Store

**Files:**
- Create: `src/shared/types/delivery.ts`
- Create: `src/shared/store/deliveryStore.ts`

- [ ] **Step 1: 型定義を作成**

`src/shared/types/delivery.ts`:
```typescript
export type GeoCodeStatus = "success" | "failed" | "pending";

export type Delivery = {
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
  geocodeStatus: GeoCodeStatus;
};

export type Driver = {
  name: string;
  color: string;
  vehicleType: "2t" | "light";
};

export type AreaRule = {
  id: string;
  region: string;
  driverName: string;
  vehicleType: "2t" | "light";
};

export const DEFAULT_DRIVERS: Driver[] = [
  { name: "ドライバー1", color: "#FF6B6B", vehicleType: "light" },
  { name: "ドライバー2", color: "#4ECDC4", vehicleType: "light" },
  { name: "ドライバー3", color: "#45B7D1", vehicleType: "light" },
  { name: "ドライバー4", color: "#96CEB4", vehicleType: "light" },
  { name: "2tドライバーA", color: "#FF8C42", vehicleType: "2t" },
  { name: "2tドライバーB", color: "#6C5CE7", vehicleType: "2t" },
];
```

- [ ] **Step 2: Zustand Store を作成**

`src/shared/store/deliveryStore.ts`:
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Delivery, Driver, AreaRule, DEFAULT_DRIVERS } from "@/shared/types/delivery";

type DeliveryStore = {
  deliveries: Delivery[];
  drivers: Driver[];
  areaRules: AreaRule[];
  selectedDeliveryId: string | null;
  driverFilter: string | null;
  isProcessing: boolean;
  processingStep: string;

  setDeliveries: (deliveries: Delivery[]) => void;
  mergeDeliveries: (newData: Delivery[]) => void;
  updateDelivery: (id: string, updates: Partial<Delivery>) => void;
  updateDriverAssignment: (id: string, driverName: string) => void;
  toggleUndelivered: (id: string) => void;
  setMemo: (id: string, memo: string) => void;
  setDrivers: (drivers: Driver[]) => void;
  setAreaRules: (rules: AreaRule[]) => void;
  selectDelivery: (id: string | null) => void;
  setDriverFilter: (driverName: string | null) => void;
  setProcessing: (step: string) => void;
  clearProcessing: () => void;
};

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set, get) => ({
      deliveries: [],
      drivers: DEFAULT_DRIVERS,
      areaRules: [],
      selectedDeliveryId: null,
      driverFilter: null,
      isProcessing: false,
      processingStep: "",

      setDeliveries: (deliveries) => set({ deliveries }),

      mergeDeliveries: (newData) => {
        const existing = get().deliveries;
        const undelivered = existing.filter((d) => d.isUndelivered);
        const newSlipNumbers = new Set(newData.map((d) => d.slipNumber));
        const keptUndelivered = undelivered.filter(
          (d) => !newSlipNumbers.has(d.slipNumber)
        );
        set({ deliveries: [...keptUndelivered, ...newData] });
      },

      updateDelivery: (id, updates) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        }),

      updateDriverAssignment: (id, driverName) => {
        const driver = get().drivers.find((d) => d.name === driverName);
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id
              ? { ...d, driverName, colorCode: driver?.color ?? null }
              : d
          ),
        });
      },

      toggleUndelivered: (id) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, isUndelivered: !d.isUndelivered } : d
          ),
        }),

      setMemo: (id, memo) =>
        set({
          deliveries: get().deliveries.map((d) =>
            d.id === id ? { ...d, memo } : d
          ),
        }),

      setDrivers: (drivers) => set({ drivers }),
      setAreaRules: (rules) => set({ areaRules: rules }),
      selectDelivery: (id) => set({ selectedDeliveryId: id }),
      setDriverFilter: (driverName) => set({ driverFilter: driverName }),
      setProcessing: (step) => set({ isProcessing: true, processingStep: step }),
      clearProcessing: () => set({ isProcessing: false, processingStep: "" }),
    }),
    {
      name: "delivery-store",
      partialize: (state) => ({
        drivers: state.drivers,
        areaRules: state.areaRules,
      }),
    }
  )
);
```

- [ ] **Step 3: コミット**

```bash
git add src/shared/
git commit -m "feat: add shared types and Zustand store with localStorage persistence"
```

---

## Task 3: Excel解析機能

**Files:**
- Create: `src/features/upload/hooks/useExcelParser.ts`
- Create: `src/features/upload/components/UploadDropzone.tsx`
- Create: `src/app/(routes)/upload/page.tsx`

- [ ] **Step 1: Excel解析 hook を作成**

`src/features/upload/hooks/useExcelParser.ts`:
```typescript
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
```

- [ ] **Step 2: UploadDropzone コンポーネント作成**

`src/features/upload/components/UploadDropzone.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { parseExcelFile } from "../hooks/useExcelParser";

export function UploadDropzone() {
  const router = useRouter();
  const { mergeDeliveries, setProcessing, clearProcessing, isProcessing, processingStep } =
    useDeliveryStore();
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.match(/\.xlsx?$/i)) {
        setError("Excelファイル（.xlsx/.xls）を選択してください");
        return;
      }

      setProcessing("Excel解析中...");
      const result = await parseExcelFile(file);

      if (!result.success) {
        setError(result.error);
        clearProcessing();
        return;
      }

      mergeDeliveries(result.deliveries);
      setProcessing("完了！地図画面に移動します...");

      setTimeout(() => {
        clearProcessing();
        router.push("/map");
      }, 1000);
    },
    [mergeDeliveries, setProcessing, clearProcessing, router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          配送先データのアップロード
        </h1>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
            ${isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}
            ${isProcessing ? "pointer-events-none opacity-60" : ""}
          `}
          onClick={() => {
            if (!isProcessing) {
              document.getElementById("file-input")?.click();
            }
          }}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-3">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-blue-600 font-medium">{processingStep}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">📁</div>
              <p className="text-lg font-medium text-gray-700">
                Excelファイルをここにドラッグ
              </p>
              <p className="text-sm text-gray-500">
                またはクリックしてファイルを選択
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById("file-input")?.click()}
            disabled={isProcessing}
          >
            ファイルを選択
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: アップロードページ作成**

`src/app/(routes)/upload/page.tsx`:
```tsx
import { UploadDropzone } from "@/features/upload/components/UploadDropzone";

export default function UploadPage() {
  return <UploadDropzone />;
}
```

- [ ] **Step 4: 動作確認**

```bash
npm run dev
```

`http://localhost:3000/upload` でドロップゾーンが表示され、Excelファイルのドラッグ&ドロップとファイル選択が動作することを確認。

- [ ] **Step 5: コミット**

```bash
git add src/features/upload/ src/app/\(routes\)/upload/
git commit -m "feat: add Excel upload and parsing feature"
```

---

## Task 4: ジオコーディング API

**Files:**
- Create: `src/lib/geocoding.ts`
- Create: `src/app/api/geocode/route.ts`

- [ ] **Step 1: ジオコーディングライブラリ作成**

`src/lib/geocoding.ts`:
```typescript
type GeocodeResult = {
  lat: number;
  lng: number;
} | null;

const cache = new Map<string, GeocodeResult>();

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (cache.has(address)) return cache.get(address)!;

  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.length > 0 && data[0].geometry?.coordinates) {
        const [lng, lat] = data[0].geometry.coordinates;
        const result = { lat, lng };
        cache.set(address, result);
        return result;
      }

      cache.set(address, null);
      return null;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  return null;
}

export async function geocodeBatch(
  addresses: { id: string; address: string }[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  const uniqueAddresses = [...new Set(addresses.map((a) => a.address))];
  const concurrency = 5;
  let completed = 0;

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueAddresses.length; i += concurrency) {
    chunks.push(uniqueAddresses.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((addr) => geocodeAddress(addr))
    );
    chunk.forEach((addr, i) => {
      results.set(addr, chunkResults[i]);
    });
    completed += chunk.length;
    onProgress?.(completed, uniqueAddresses.length);
  }

  return results;
}
```

- [ ] **Step 2: APIルート作成**

`src/app/api/geocode/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { geocodeBatch } from "@/lib/geocoding";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const addresses: { id: string; address: string }[] = body.addresses;

  if (!addresses || !Array.isArray(addresses)) {
    return NextResponse.json({ error: "addresses is required" }, { status: 400 });
  }

  const results = await geocodeBatch(addresses);
  const response = Object.fromEntries(results);

  return NextResponse.json({ results: response });
}
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/geocoding.ts src/app/api/geocode/
git commit -m "feat: add geocoding library with GSI API and batch processing"
```

---

## Task 5: Gemini Flash 自動振り分け

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/app/api/assign/route.ts`

- [ ] **Step 1: Gemini クライアント作成**

`src/lib/gemini.ts`:
```typescript
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
```

- [ ] **Step 2: APIルート作成**

`src/app/api/assign/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Driver, AreaRule } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deliveries, drivers, areaRules } = body as {
    deliveries: Delivery[];
    drivers: Driver[];
    areaRules: AreaRule[];
  };

  if (!deliveries || !drivers) {
    return NextResponse.json({ error: "deliveries and drivers are required" }, { status: 400 });
  }

  const assignments = await autoAssign(deliveries, drivers, areaRules || []);
  return NextResponse.json({ assignments });
}
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/gemini.ts src/app/api/assign/
git commit -m "feat: add Gemini Flash auto-assignment with batch processing"
```

---

## Task 6: 地図画面 - Leaflet地図 & ピン表示

**Files:**
- Create: `src/features/map/components/DeliveryMap.tsx`
- Create: `src/features/map/components/DeliveryPin.tsx`
- Create: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: Leaflet CSS を追加**

`src/app/layout.tsx` の `<head>` に Leaflet CSS を追加（linkタグ方式）。

もしくは `src/app/globals.css` に追加:
```css
@import "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
```

- [ ] **Step 2: DeliveryPin コンポーネント作成**

`src/features/map/components/DeliveryPin.tsx`:
```tsx
"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Delivery } from "@/shared/types/delivery";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

function createPinIcon(color: string, isLarge: boolean): L.DivIcon {
  const size = isLarge ? 20 : 14;
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Props = {
  delivery: Delivery;
};

export function DeliveryPin({ delivery }: Props) {
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);

  if (delivery.lat == null || delivery.lng == null) return null;

  const color = delivery.colorCode || "#9CA3AF";
  const isLarge = delivery.volume >= 1000;
  const icon = createPinIcon(color, isLarge);

  return (
    <Marker
      position={[delivery.lat, delivery.lng]}
      icon={icon}
      eventHandlers={{
        click: () => selectDelivery(delivery.id),
      }}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-bold">{delivery.destinationName}</p>
          <p>{delivery.address}</p>
          <p>容積: {delivery.volume}L / 重量: {delivery.actualWeight}kg</p>
        </div>
      </Popup>
    </Marker>
  );
}
```

- [ ] **Step 3: DeliveryMap コンポーネント作成**

`src/features/map/components/DeliveryMap.tsx`:
```tsx
"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryPin } from "./DeliveryPin";
import "leaflet/dist/leaflet.css";

export function DeliveryMap() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);

  const filteredDeliveries = deliveries.filter((d) => {
    if (d.geocodeStatus !== "success") return false;
    if (driverFilter && d.driverName !== driverFilter) return false;
    return true;
  });

  const center: [number, number] =
    filteredDeliveries.length > 0 && filteredDeliveries[0].lat && filteredDeliveries[0].lng
      ? [filteredDeliveries[0].lat, filteredDeliveries[0].lng]
      : [35.4, 139.5];

  return (
    <MapContainer
      center={center}
      zoom={11}
      className="h-full w-full"
      style={{ minHeight: "500px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {filteredDeliveries.map((delivery) => (
        <DeliveryPin key={delivery.id} delivery={delivery} />
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 4: 地図ページ作成（dynamic importでSSR回避）**

`src/app/(routes)/map/page.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

const DeliveryMap = dynamic(
  () => import("@/features/map/components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function MapPage() {
  const deliveries = useDeliveryStore((s) => s.deliveries);

  if (deliveries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">配送データがありません</p>
          <Link href="/upload">
            <Button>データをアップロード</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">配送先マッピングシステム</h1>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" size="sm">データ追加</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm">設定</Button>
          </Link>
          <Button size="sm" id="pdf-download-btn">PDF出力</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <DeliveryMap />
        </div>
        <div className="w-80 border-l bg-white overflow-y-auto">
          {/* PinDetailPanel と DeliveryListPanel を後のタスクで追加 */}
          <div className="p-4 text-sm text-gray-500">
            ピンをクリックすると詳細が表示されます
          </div>
        </div>
      </div>

      <footer className="px-4 py-2 bg-white border-t text-sm text-gray-600">
        全{deliveries.length}件 / 未割当{deliveries.filter((d) => !d.driverName).length}件 / 未配{deliveries.filter((d) => d.isUndelivered).length}件
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: 動作確認**

`npm run dev` でアップロード → 地図遷移のフローを確認。（この時点ではジオコーディングが未接続のため、ピンは表示されないが、地図とレイアウトが表示されることを確認）

- [ ] **Step 6: コミット**

```bash
git add src/features/map/ src/app/\(routes\)/map/
git commit -m "feat: add map page with Leaflet and delivery pins"
```

---

## Task 7: アップロード → ジオコーディング → 振り分けフロー接続

**Files:**
- Modify: `src/features/upload/components/UploadDropzone.tsx`
- Create: `src/features/assignment/hooks/useAutoAssign.ts`

- [ ] **Step 1: 自動振り分けフック作成**

`src/features/assignment/hooks/useAutoAssign.ts`:
```typescript
"use client";

import { useCallback } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Delivery } from "@/shared/types/delivery";

export function useAutoAssign() {
  const { deliveries, drivers, areaRules, setDeliveries, setProcessing, clearProcessing } =
    useDeliveryStore();

  const runGeocoding = useCallback(async (items: Delivery[]): Promise<Delivery[]> => {
    setProcessing("住所を変換中...");

    const pendingAddresses = items
      .filter((d) => d.geocodeStatus === "pending" && d.address)
      .map((d) => ({ id: d.id, address: d.address }));

    if (pendingAddresses.length === 0) return items;

    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: pendingAddresses }),
      });
      const data = await res.json();
      const results: Record<string, { lat: number; lng: number } | null> = data.results;

      return items.map((d) => {
        if (d.geocodeStatus !== "pending") return d;
        const result = results[d.address];
        if (result) {
          return { ...d, lat: result.lat, lng: result.lng, geocodeStatus: "success" as const };
        }
        return { ...d, geocodeStatus: "failed" as const };
      });
    } catch {
      return items.map((d) =>
        d.geocodeStatus === "pending" ? { ...d, geocodeStatus: "failed" as const } : d
      );
    }
  }, [setProcessing]);

  const runAssignment = useCallback(async (items: Delivery[]): Promise<Delivery[]> => {
    setProcessing("自動振り分け中...");

    const unassigned = items.filter((d) => !d.driverName && d.geocodeStatus === "success");
    if (unassigned.length === 0) return items;

    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveries: unassigned, drivers, areaRules }),
      });
      const data = await res.json();
      const assignMap = new Map<string, string>();
      for (const a of data.assignments) {
        if (a.driverName) assignMap.set(a.deliveryId, a.driverName);
      }

      return items.map((d) => {
        const assigned = assignMap.get(d.id);
        if (assigned) {
          const driver = drivers.find((dr) => dr.name === assigned);
          return { ...d, driverName: assigned, colorCode: driver?.color ?? null };
        }
        return d;
      });
    } catch {
      return items;
    }
  }, [drivers, areaRules, setProcessing]);

  const processAll = useCallback(async (newDeliveries: Delivery[]) => {
    let items = newDeliveries;
    items = await runGeocoding(items);
    items = await runAssignment(items);
    setDeliveries(items);
    clearProcessing();
  }, [runGeocoding, runAssignment, setDeliveries, clearProcessing]);

  return { processAll };
}
```

- [ ] **Step 2: UploadDropzone にフロー接続**

`src/features/upload/components/UploadDropzone.tsx` を修正:

`handleFile` 関数内で、`mergeDeliveries` の後に `processAll` を呼び出すように変更。

```tsx
// import を追加
import { useAutoAssign } from "@/features/assignment/hooks/useAutoAssign";

// コンポーネント内
const { processAll } = useAutoAssign();

// handleFile 内を修正:
const handleFile = useCallback(
  async (file: File) => {
    setError(null);

    if (!file.name.match(/\.xlsx?$/i)) {
      setError("Excelファイル（.xlsx/.xls）を選択してください");
      return;
    }

    setProcessing("Excel解析中...");
    const result = await parseExcelFile(file);

    if (!result.success) {
      setError(result.error);
      clearProcessing();
      return;
    }

    mergeDeliveries(result.deliveries);
    const allDeliveries = useDeliveryStore.getState().deliveries;
    await processAll(allDeliveries);
    router.push("/map");
  },
  [mergeDeliveries, setProcessing, clearProcessing, router, processAll]
);
```

- [ ] **Step 3: 動作確認**

Excelアップロード → ジオコーディング → 自動振り分け → 地図表示の全フローを確認。

- [ ] **Step 4: コミット**

```bash
git add src/features/assignment/ src/features/upload/
git commit -m "feat: connect upload → geocoding → auto-assignment pipeline"
```

---

## Task 8: サイドパネル（ピン詳細 & 配送先一覧 & ドライバーフィルター）

**Files:**
- Create: `src/features/map/components/PinDetailPanel.tsx`
- Create: `src/features/map/components/DeliveryListPanel.tsx`
- Create: `src/features/map/components/GeocodingErrorList.tsx`
- Create: `src/features/assignment/components/DriverFilterBar.tsx`
- Modify: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: PinDetailPanel 作成**

`src/features/map/components/PinDetailPanel.tsx`:
```tsx
"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function PinDetailPanel() {
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const drivers = useDeliveryStore((s) => s.drivers);
  const updateDriverAssignment = useDeliveryStore((s) => s.updateDriverAssignment);
  const toggleUndelivered = useDeliveryStore((s) => s.toggleUndelivered);
  const setMemo = useDeliveryStore((s) => s.setMemo);

  const delivery = deliveries.find((d) => d.id === selectedId);

  if (!delivery) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        ピンをクリックすると詳細が表示されます
      </div>
    );
  }

  const readOnlyFields = [
    { label: "届先名", value: delivery.destinationName },
    { label: "個口数", value: `${delivery.packageCount}` },
    { label: "実重量", value: `${delivery.actualWeight} kg` },
    { label: "容積", value: `${delivery.volume} L` },
    { label: "届先住所", value: delivery.address },
    { label: "納品日", value: delivery.deliveryDate },
    { label: "伝票番号", value: `${delivery.slipNumber}` },
    { label: "出荷番号", value: `${delivery.shippingNumber}` },
  ];

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-bold text-sm">配送先情報</h3>
      <Separator />

      {readOnlyFields.map((field) => (
        <div key={field.label}>
          <Label className="text-xs text-gray-500">{field.label}</Label>
          <p className="text-sm">{field.value}</p>
        </div>
      ))}

      <Separator />

      <div>
        <Label className="text-xs text-gray-500">担当ドライバー</Label>
        <Select
          value={delivery.driverName || ""}
          onValueChange={(value) => updateDriverAssignment(delivery.id, value)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="未割当" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={driver.name} value={driver.name}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: driver.color }}
                  />
                  {driver.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">未配</Label>
        <Switch
          checked={delivery.isUndelivered}
          onCheckedChange={() => toggleUndelivered(delivery.id)}
        />
      </div>

      <div>
        <Label className="text-xs text-gray-500">メモ</Label>
        <Input
          className="mt-1"
          value={delivery.memo}
          onChange={(e) => setMemo(delivery.id, e.target.value)}
          placeholder="メモを入力..."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: DeliveryListPanel 作成**

`src/features/map/components/DeliveryListPanel.tsx`:
```tsx
"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function DeliveryListPanel() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const selectDelivery = useDeliveryStore((s) => s.selectDelivery);
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);

  const filtered = deliveries.filter((d) => {
    if (driverFilter && d.driverName !== driverFilter) return false;
    return true;
  });

  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600">
        配送先一覧（{filtered.length}件）
      </div>
      <ScrollArea className="h-64">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`px-4 py-2 border-b cursor-pointer hover:bg-blue-50 text-sm ${
              selectedId === d.id ? "bg-blue-100" : ""
            }`}
            onClick={() => selectDelivery(d.id)}
          >
            <div className="flex items-center gap-2">
              {d.colorCode && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.colorCode }}
                />
              )}
              <span className="font-medium truncate">{d.destinationName}</span>
              {d.isUndelivered && <Badge variant="destructive" className="text-xs">未配</Badge>}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{d.address}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 3: GeocodingErrorList 作成**

`src/features/map/components/GeocodingErrorList.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function GeocodingErrorList() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const [isOpen, setIsOpen] = useState(false);

  const failed = deliveries.filter((d) => d.geocodeStatus === "failed");
  if (failed.length === 0) return null;

  return (
    <div className="px-4 py-1 text-sm">
      <button
        className="text-orange-600 hover:underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        プロット失敗: {failed.length}件 {isOpen ? "▲" : "▼"}
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-1 text-xs text-gray-600 max-h-32 overflow-y-auto">
          {failed.map((d) => (
            <li key={d.id}>
              {d.destinationName} - {d.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: DriverFilterBar 作成**

`src/features/assignment/components/DriverFilterBar.tsx`:
```tsx
"use client";

import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";

export function DriverFilterBar() {
  const drivers = useDeliveryStore((s) => s.drivers);
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const driverFilter = useDeliveryStore((s) => s.driverFilter);
  const setDriverFilter = useDeliveryStore((s) => s.setDriverFilter);

  const assignedDrivers = [...new Set(deliveries.map((d) => d.driverName).filter(Boolean))];
  const activeDrivers = drivers.filter((d) => assignedDrivers.includes(d.name));

  return (
    <div className="p-3 space-y-2 border-b">
      <p className="text-xs font-medium text-gray-500">ドライバー</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={driverFilter === null ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => setDriverFilter(null)}
        >
          全員
        </Button>
        {activeDrivers.map((driver) => (
          <Button
            key={driver.name}
            size="sm"
            variant={driverFilter === driver.name ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() =>
              setDriverFilter(driverFilter === driver.name ? null : driver.name)
            }
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1"
              style={{ backgroundColor: driver.color }}
            />
            {driver.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: useMapInteraction フック作成**

`src/features/map/hooks/useMapInteraction.ts`:
リスト内の配送先をクリックした時に、地図をその地点にパン＋ズームする機能。
DeliveryMap内でuseMapEventsを使い、selectedDeliveryIdが変更された時にflyToを実行する。

```typescript
"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

export function MapInteractionHandler() {
  const map = useMap();
  const selectedId = useDeliveryStore((s) => s.selectedDeliveryId);
  const deliveries = useDeliveryStore((s) => s.deliveries);

  useEffect(() => {
    if (!selectedId) return;
    const delivery = deliveries.find((d) => d.id === selectedId);
    if (delivery?.lat && delivery?.lng) {
      map.flyTo([delivery.lat, delivery.lng], 14, { duration: 0.5 });
    }
  }, [selectedId, deliveries, map]);

  return null;
}
```

DeliveryMap.tsxの`<MapContainer>`内に`<MapInteractionHandler />`を追加。

- [ ] **Step 6: map/page.tsx にコンポーネント統合**

サイドパネルのプレースホルダーを `DriverFilterBar`, `PinDetailPanel`, `DeliveryListPanel` に差し替え。フッターに `GeocodingErrorList` を追加。

- [ ] **Step 7: 動作確認**

Excelアップロード後、地図画面でピンクリック → サイドパネル表示、ドライバーフィルター切替、詳細編集が動作することを確認。

- [ ] **Step 7: コミット**

```bash
git add src/features/map/ src/features/assignment/ src/app/\(routes\)/map/
git commit -m "feat: add side panel with pin detail, delivery list, driver filter"
```

---

## Task 9: PDF出力機能

**Files:**
- Create: `src/features/pdf/components/DeliveryReport.tsx`
- Create: `src/features/pdf/hooks/usePdfGenerate.ts`
- Modify: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: PDF文書レイアウト作成**

`src/features/pdf/components/DeliveryReport.tsx`:
```tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Delivery, Driver } from "@/shared/types/delivery";

Font.register({
  family: "NotoSansJP",
  src: "https://fonts.gstatic.com/s/notosansjp/v53/-F62fjtqLzI2JPCgQBnw7HFow2om.ttf",
});

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "NotoSansJP", fontSize: 9 },
  header: { marginBottom: 15 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  table: { width: "100%", marginTop: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #d1d5db",
    padding: 4,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    padding: 4,
  },
  col1: { width: "16%" },
  col2: { width: "6%" },
  col3: { width: "7%" },
  col4: { width: "6%" },
  col5: { width: "22%" },
  col6: { width: "7%" },
  col7: { width: "10%" },
  col8: { width: "10%" },
  col9: { width: "5%" },
  col10: { width: "11%" },
  summary: { marginTop: 10, fontSize: 10 },
});

type Props = {
  deliveries: Delivery[];
  drivers: Driver[];
  date: string;
};

export function DeliveryReport({ deliveries, drivers, date }: Props) {
  const grouped = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    const key = d.driverName || "未割当";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  return (
    <Document>
      {Array.from(grouped.entries()).map(([driverName, items]) => {
        const driver = drivers.find((d) => d.name === driverName);
        const totalWeight = items.reduce((s, d) => s + d.actualWeight, 0);
        const totalVolume = items.reduce((s, d) => s + d.volume, 0);

        return (
          <Page key={driverName} size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>{driverName}</Text>
              <Text style={styles.subtitle}>
                {date} | {items.length}件 | 重量合計: {totalWeight}kg | 容積合計: {totalVolume}L
                {driver ? ` | 車両: ${driver.vehicleType === "2t" ? "2tトラック" : "軽自動車"}` : ""}
              </Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>届先名</Text>
                <Text style={styles.col2}>個口数</Text>
                <Text style={styles.col3}>実重量</Text>
                <Text style={styles.col4}>容積</Text>
                <Text style={styles.col5}>届先住所</Text>
                <Text style={styles.col6}>納品日</Text>
                <Text style={styles.col7}>伝票番号</Text>
                <Text style={styles.col8}>出荷番号</Text>
                <Text style={styles.col9}>未配</Text>
                <Text style={styles.col10}>メモ</Text>
              </View>
              {items.map((d) => (
                <View key={d.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{d.destinationName}</Text>
                  <Text style={styles.col2}>{d.packageCount}</Text>
                  <Text style={styles.col3}>{d.actualWeight}kg</Text>
                  <Text style={styles.col4}>{d.volume}L</Text>
                  <Text style={styles.col5}>{d.address}</Text>
                  <Text style={styles.col6}>{d.deliveryDate}</Text>
                  <Text style={styles.col7}>{d.slipNumber}</Text>
                  <Text style={styles.col8}>{d.shippingNumber}</Text>
                  <Text style={styles.col9}>{d.isUndelivered ? "○" : ""}</Text>
                  <Text style={styles.col10}>{d.memo}</Text>
                </View>
              ))}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
```

- [ ] **Step 2: PDF生成フック作成**

`src/features/pdf/hooks/usePdfGenerate.ts`:
```typescript
"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { DeliveryReport } from "../components/DeliveryReport";

export function usePdfGenerate() {
  const deliveries = useDeliveryStore((s) => s.deliveries);
  const drivers = useDeliveryStore((s) => s.drivers);

  const generatePdf = useCallback(async () => {
    const today = new Date().toLocaleDateString("ja-JP");
    const doc = DeliveryReport({ deliveries, drivers, date: today });
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `配送リスト_${today.replace(/\//g, "")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [deliveries, drivers]);

  return { generatePdf };
}
```

- [ ] **Step 3: map/page.tsx にPDFボタン接続**

PDF出力ボタンの `onClick` に `generatePdf` を接続。

- [ ] **Step 4: 動作確認**

PDF出力ボタンをクリックし、ドライバー別にグループ化されたPDFがダウンロードされることを確認。

- [ ] **Step 5: コミット**

```bash
git add src/features/pdf/ src/app/\(routes\)/map/
git commit -m "feat: add PDF generation with driver-grouped delivery reports"
```

---

## Task 10: 地域割り設定画面

**Files:**
- Create: `src/features/settings/components/AreaRuleEditor.tsx`
- Create: `src/app/(routes)/settings/page.tsx`

- [ ] **Step 1: AreaRuleEditor 作成**

`src/features/settings/components/AreaRuleEditor.tsx`:
```tsx
"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Driver, AreaRule } from "@/shared/types/delivery";

export function AreaRuleEditor() {
  const { drivers, setDrivers, areaRules, setAreaRules } = useDeliveryStore();

  // Driver editing
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverColor, setNewDriverColor] = useState("#FF6B6B");
  const [newDriverVehicle, setNewDriverVehicle] = useState<"2t" | "light">("light");

  const addDriver = () => {
    if (!newDriverName.trim()) return;
    const newDriver: Driver = {
      name: newDriverName.trim(),
      color: newDriverColor,
      vehicleType: newDriverVehicle,
    };
    setDrivers([...drivers, newDriver]);
    setNewDriverName("");
  };

  const removeDriver = (name: string) => {
    setDrivers(drivers.filter((d) => d.name !== name));
  };

  // Area rule editing
  const [newRegion, setNewRegion] = useState("");
  const [newRuleDriver, setNewRuleDriver] = useState("");
  const [newRuleVehicle, setNewRuleVehicle] = useState<"2t" | "light">("light");

  const addAreaRule = () => {
    if (!newRegion.trim() || !newRuleDriver) return;
    const rule: AreaRule = {
      id: uuidv4(),
      region: newRegion.trim(),
      driverName: newRuleDriver,
      vehicleType: newRuleVehicle,
    };
    setAreaRules([...areaRules, rule]);
    setNewRegion("");
  };

  const removeAreaRule = (id: string) => {
    setAreaRules(areaRules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">ドライバー管理</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>色</TableHead>
              <TableHead>車両</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((d) => (
              <TableRow key={d.name}>
                <TableCell className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                  {d.name}
                </TableCell>
                <TableCell>{d.color}</TableCell>
                <TableCell>{d.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeDriver(d.name)}>
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex gap-2 mt-4">
          <Input placeholder="ドライバー名" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} className="flex-1" />
          <Input type="color" value={newDriverColor} onChange={(e) => setNewDriverColor(e.target.value)} className="w-16" />
          <Select value={newDriverVehicle} onValueChange={(v) => setNewDriverVehicle(v as "2t" | "light")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">軽自動車</SelectItem>
              <SelectItem value="2t">2tトラック</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addDriver}>追加</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">エリアルール</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>地域</TableHead>
              <TableHead>ドライバー</TableHead>
              <TableHead>車両</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areaRules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.region}</TableCell>
                <TableCell>{r.driverName}</TableCell>
                <TableCell>{r.vehicleType === "2t" ? "2tトラック" : "軽自動車"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeAreaRule(r.id)}>
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex gap-2 mt-4">
          <Input placeholder="地域名（例: 横浜市戸塚区）" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} className="flex-1" />
          <Select value={newRuleDriver} onValueChange={setNewRuleDriver}>
            <SelectTrigger className="w-40"><SelectValue placeholder="ドライバー" /></SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newRuleVehicle} onValueChange={(v) => setNewRuleVehicle(v as "2t" | "light")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">軽自動車</SelectItem>
              <SelectItem value="2t">2tトラック</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addAreaRule}>追加</Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 設定ページ作成**

`src/app/(routes)/settings/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AreaRuleEditor } from "@/features/settings/components/AreaRuleEditor";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b">
        <h1 className="text-lg font-bold">設定</h1>
        <Link href="/map">
          <Button variant="outline" size="sm">地図に戻る</Button>
        </Link>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <AreaRuleEditor />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 動作確認**

設定画面でドライバーの追加・削除、エリアルールの追加・削除ができることを確認。リロード後もlocalStorageから復元されることを確認。

- [ ] **Step 4: コミット**

```bash
git add src/features/settings/ src/app/\(routes\)/settings/
git commit -m "feat: add settings page for driver and area rule management"
```

---

## Task 11: 共有リンク & ドライバー参照ビュー

**Files:**
- Create: `src/app/api/share/route.ts`
- Create: `src/app/(routes)/view/[sessionId]/page.tsx`
- Modify: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: 共有API作成**

`src/app/api/share/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const shareStore = new Map<string, { data: unknown; createdAt: number }>();

// 1時間以上経過したデータを削除
function cleanup() {
  const now = Date.now();
  for (const [key, value] of shareStore) {
    if (now - value.createdAt > 3600000) shareStore.delete(key);
  }
}

export async function POST(request: NextRequest) {
  cleanup();
  const body = await request.json();
  const sessionId = uuidv4();
  shareStore.set(sessionId, { data: body, createdAt: Date.now() });
  return NextResponse.json({ sessionId });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !shareStore.has(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(shareStore.get(id)!.data);
}
```

- [ ] **Step 2: ドライバー参照ビュー作成**

取得した配送データをZustand storeにセットしてからDeliveryMapを表示する。`dynamic()` はモジュールスコープで呼び出す。

`src/app/(routes)/view/[sessionId]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useDeliveryStore } from "@/shared/store/deliveryStore";

const DeliveryMap = dynamic(
  () => import("@/features/map/components/DeliveryMap").then((m) => ({ default: m.DeliveryMap })),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center">地図を読み込み中...</div> }
);

export default function SharedViewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setDeliveries = useDeliveryStore((s) => s.setDeliveries);
  const setDrivers = useDeliveryStore((s) => s.setDrivers);

  useEffect(() => {
    fetch(`/api/share?id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("データが見つかりません。リンクの有効期限が切れている可能性があります。");
        return res.json();
      })
      .then((data) => {
        setDeliveries(data.deliveries || []);
        if (data.drivers) setDrivers(data.drivers);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [sessionId, setDeliveries, setDrivers]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-lg font-bold">配送先マップ（参照用）</h1>
      </header>
      <div className="flex-1">
        <DeliveryMap />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: map/page.tsx に共有リンク生成ボタン追加**

フッターに「共有リンク生成」ボタンを追加。クリック時に `/api/share` にPOSTしてURLを生成・クリップボードにコピー。

- [ ] **Step 4: 動作確認**

共有リンク生成 → リンクを別タブで開き、データが表示されることを確認。

- [ ] **Step 5: コミット**

```bash
git add src/app/api/share/ src/app/\(routes\)/view/
git commit -m "feat: add share API and read-only driver view"
```

---

## Task 12: 最終結合 & 動作確認

**Files:**
- Modify: Various (微調整)

- [ ] **Step 1: 全フロー E2E 動作確認**

1. `http://localhost:3000` → 「はじめる」クリック
2. アップロード画面でExcelファイル（テストデータ）をドラッグ&ドロップ
3. 「Excel解析中... → 住所変換中... → 自動振り分け中...」の進行表示
4. 地図画面に遷移、ピンが色分け表示
5. ピンクリック → サイドパネルに詳細表示
6. ドライバー変更、未配トグル、メモ入力
7. ドライバーフィルターで絞り込み
8. PDF出力ボタン → ドライバー別PDFダウンロード
9. 設定画面でドライバー追加・削除
10. 共有リンク生成 → 別タブで表示確認

- [ ] **Step 2: UIの微調整**

フォントサイズ、余白、ボタンサイズなどをITに不慣れなユーザー向けに調整（大きめのクリック領域、明確なラベル）。

- [ ] **Step 3: 最終コミット**

```bash
git add -A
git commit -m "feat: final integration and UI polish for delivery mapping prototype"
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

ビルドが通ることを確認。
