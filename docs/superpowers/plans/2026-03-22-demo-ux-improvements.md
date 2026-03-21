# デモUX改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 営業デモ向けに、モックログイン→地図メイン画面→地図上Excel D&D→バックグラウンドAI処理のフローを実装。既存コードのテストカバレッジも確保する。

**Architecture:** Vitest + React Testing Library でTDD。ログインはモック（認証なし、見た目のみ）。地図画面をメインに据え、UploadDropzoneを地図画面に統合。AI処理は非同期化してUI操作をブロックしない。

**Tech Stack:** Vitest, @testing-library/react, @testing-library/user-event, jsdom

**Spec:** `docs/superpowers/specs/2026-03-19-delivery-mapping-system-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `vitest.config.ts` | Vitest設定 |
| `src/test/setup.ts` | テスト共通セットアップ |
| `src/test/mocks/delivery.ts` | テスト用モックデータ |
| `src/app/(routes)/login/page.tsx` | モックログイン画面 |
| `src/features/auth/components/LoginForm.tsx` | ログインフォームUI |
| `src/features/upload/components/MapDropzone.tsx` | 地図画面用ドロップゾーンオーバーレイ |

### Modified Files
| File | Change |
|------|--------|
| `package.json` | テストフレームワーク追加 |
| `src/app/page.tsx` | `/login`にリダイレクト |
| `src/app/(routes)/map/page.tsx` | MapDropzone統合、バックグラウンド処理 |
| `src/features/assignment/hooks/useAutoAssign.ts` | 非同期処理（UIブロックしない） |
| `src/shared/store/deliveryStore.ts` | 処理状態の拡張 |

### Test Files
| File | 対象 |
|------|------|
| `src/shared/store/__tests__/deliveryStore.test.ts` | Zustand store |
| `src/features/upload/hooks/__tests__/useExcelParser.test.ts` | Excel解析 |
| `src/features/auth/components/__tests__/LoginForm.test.tsx` | ログインフォーム |
| `src/features/upload/components/__tests__/MapDropzone.test.tsx` | 地図D&D |

---

## Task 1: テストフレームワーク セットアップ

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/mocks/delivery.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Vitest + Testing Library インストール**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react jsdom
```

- [ ] **Step 2: vitest.config.ts 作成**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: テストセットアップ作成**

`src/test/setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: モックデータ作成**

`src/test/mocks/delivery.ts`:
```typescript
import { Delivery, Driver } from "@/shared/types/delivery";

export function createMockDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "test-id-1",
    factoryName: "テスト工場",
    carrierCode: 100,
    carrierName: "テスト運送",
    destinationCode: 200,
    destinationName: "テスト届先",
    packageCount: 3,
    quantity: 10,
    caseCount: 2,
    assortQuantity: 0,
    actualWeight: 50,
    volume: 120,
    addressCode: 14100,
    address: "神奈川県横浜市戸塚区上矢部町1-1",
    deliveryDate: "320",
    slipNumber: 12345678,
    shippingNumber: 87654321,
    shippingCategory: "★県別（関東）",
    lat: 35.4,
    lng: 139.5,
    driverName: null,
    colorCode: null,
    isUndelivered: false,
    memo: "",
    assignReason: "",
    geocodeStatus: "pending",
    ...overrides,
  };
}

export function createMockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    name: "コース1（軽）",
    color: "#34A853",
    vehicleType: "light",
    ...overrides,
  };
}
```

- [ ] **Step 5: package.json に test スクリプト追加**

```bash
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest" scripts.test:coverage="vitest run --coverage"
```

- [ ] **Step 6: 動作確認用の最小テスト作成・実行**

`src/shared/store/__tests__/deliveryStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useDeliveryStore } from "../deliveryStore";
import { createMockDelivery } from "@/test/mocks/delivery";

describe("deliveryStore", () => {
  beforeEach(() => {
    useDeliveryStore.setState({
      deliveries: [],
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set(),
      driverFilter: null,
      isProcessing: false,
      processingStep: "",
    });
  });

  it("setDeliveries stores deliveries", () => {
    const d = createMockDelivery();
    useDeliveryStore.getState().setDeliveries([d]);
    expect(useDeliveryStore.getState().deliveries).toHaveLength(1);
    expect(useDeliveryStore.getState().deliveries[0].id).toBe("test-id-1");
  });
});
```

```bash
npx vitest run
```

Expected: 1 test passes.

- [ ] **Step 7: コミット**

```bash
git add vitest.config.ts src/test/ src/shared/store/__tests__/ package.json package-lock.json
git commit -m "chore: add Vitest + Testing Library with initial store test"
```

---

## Task 2: 既存コアロジックのテスト追加

**Files:**
- Create: `src/shared/store/__tests__/deliveryStore.test.ts` (拡張)
- Create: `src/features/upload/hooks/__tests__/useExcelParser.test.ts`

- [ ] **Step 1: Zustand Store の全アクションテスト**

`src/shared/store/__tests__/deliveryStore.test.ts` に追加:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useDeliveryStore } from "../deliveryStore";
import { createMockDelivery, createMockDriver } from "@/test/mocks/delivery";

describe("deliveryStore", () => {
  beforeEach(() => {
    useDeliveryStore.setState({
      deliveries: [],
      drivers: [
        createMockDriver({ name: "コース1（軽）", color: "#34A853" }),
        createMockDriver({ name: "コース2（軽）", color: "#4285F4" }),
      ],
      areaRules: [],
      selectedDeliveryId: null,
      selectedDeliveryIds: new Set(),
      driverFilter: null,
      isProcessing: false,
      processingStep: "",
    });
  });

  describe("setDeliveries", () => {
    it("stores deliveries", () => {
      const d = createMockDelivery();
      useDeliveryStore.getState().setDeliveries([d]);
      expect(useDeliveryStore.getState().deliveries).toHaveLength(1);
    });
  });

  describe("mergeDeliveries", () => {
    it("keeps undelivered items and merges new data", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: true });
      const newItem = createMockDelivery({ id: "new", slipNumber: 222 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      const result = useDeliveryStore.getState().deliveries;
      expect(result).toHaveLength(2);
      expect(result.find((d) => d.id === "old")).toBeTruthy();
    });

    it("replaces undelivered items if same slip number in new data", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: true });
      const newItem = createMockDelivery({ id: "new", slipNumber: 111 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      const result = useDeliveryStore.getState().deliveries;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new");
    });

    it("discards non-undelivered existing items", () => {
      const existing = createMockDelivery({ id: "old", slipNumber: 111, isUndelivered: false });
      const newItem = createMockDelivery({ id: "new", slipNumber: 222 });
      useDeliveryStore.getState().setDeliveries([existing]);
      useDeliveryStore.getState().mergeDeliveries([newItem]);
      expect(useDeliveryStore.getState().deliveries).toHaveLength(1);
      expect(useDeliveryStore.getState().deliveries[0].id).toBe("new");
    });
  });

  describe("updateDriverAssignment", () => {
    it("sets driver name and color code", () => {
      const d = createMockDelivery({ id: "d1" });
      useDeliveryStore.getState().setDeliveries([d]);
      useDeliveryStore.getState().updateDriverAssignment("d1", "コース1（軽）");
      const updated = useDeliveryStore.getState().deliveries[0];
      expect(updated.driverName).toBe("コース1（軽）");
      expect(updated.colorCode).toBe("#34A853");
    });
  });

  describe("toggleUndelivered", () => {
    it("toggles isUndelivered flag", () => {
      const d = createMockDelivery({ id: "d1", isUndelivered: false });
      useDeliveryStore.getState().setDeliveries([d]);
      useDeliveryStore.getState().toggleUndelivered("d1");
      expect(useDeliveryStore.getState().deliveries[0].isUndelivered).toBe(true);
      useDeliveryStore.getState().toggleUndelivered("d1");
      expect(useDeliveryStore.getState().deliveries[0].isUndelivered).toBe(false);
    });
  });

  describe("bulkAssignDriver", () => {
    it("assigns driver to multiple deliveries", () => {
      const d1 = createMockDelivery({ id: "d1" });
      const d2 = createMockDelivery({ id: "d2" });
      const d3 = createMockDelivery({ id: "d3" });
      useDeliveryStore.getState().setDeliveries([d1, d2, d3]);
      useDeliveryStore.getState().bulkAssignDriver(["d1", "d3"], "コース2（軽）");
      const deliveries = useDeliveryStore.getState().deliveries;
      expect(deliveries[0].driverName).toBe("コース2（軽）");
      expect(deliveries[1].driverName).toBeNull();
      expect(deliveries[2].driverName).toBe("コース2（軽）");
    });
  });

  describe("setProcessing / clearProcessing", () => {
    it("sets and clears processing state", () => {
      useDeliveryStore.getState().setProcessing("テスト中...");
      expect(useDeliveryStore.getState().isProcessing).toBe(true);
      expect(useDeliveryStore.getState().processingStep).toBe("テスト中...");
      useDeliveryStore.getState().clearProcessing();
      expect(useDeliveryStore.getState().isProcessing).toBe(false);
    });
  });

  describe("selection", () => {
    it("selectDelivery sets selectedDeliveryId", () => {
      useDeliveryStore.getState().selectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryId).toBe("d1");
    });

    it("toggleSelectDelivery adds and removes from set", () => {
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryIds.has("d1")).toBe(true);
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      expect(useDeliveryStore.getState().selectedDeliveryIds.has("d1")).toBe(false);
    });

    it("clearSelection empties the set", () => {
      useDeliveryStore.getState().toggleSelectDelivery("d1");
      useDeliveryStore.getState().toggleSelectDelivery("d2");
      useDeliveryStore.getState().clearSelection();
      expect(useDeliveryStore.getState().selectedDeliveryIds.size).toBe(0);
    });
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run
```

Expected: 全テストパス。

- [ ] **Step 3: Excel Parser テスト作成**

`src/features/upload/hooks/__tests__/useExcelParser.test.ts`:
```typescript
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
    }
  });

  it("returns error for empty data", async () => {
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

  it("rejects non-Excel file", async () => {
    const file = new File(["not excel"], "test.txt", { type: "text/plain" });
    const result = await parseExcelFile(file);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: テスト実行**

```bash
npx vitest run
```

- [ ] **Step 5: コミット**

```bash
git add src/shared/store/__tests__/ src/features/upload/hooks/__tests__/
git commit -m "test: add comprehensive store and Excel parser tests"
```

---

## Task 3: モックログイン画面

**Files:**
- Create: `src/features/auth/components/__tests__/LoginForm.test.tsx`
- Create: `src/features/auth/components/LoginForm.tsx`
- Create: `src/app/(routes)/login/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: LoginForm テスト作成**

`src/features/auth/components/__tests__/LoginForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../LoginForm";

// next/navigation のモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("LoginForm", () => {
  it("renders login form with ID and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("ユーザーID")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
  });

  it("shows error when fields are empty and submit is clicked", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "ログイン" }));
    expect(screen.getByText("ユーザーIDとパスワードを入力してください")).toBeInTheDocument();
  });

  it("navigates to /map on successful login", async () => {
    const mockPush = vi.fn();
    vi.mocked(await import("next/navigation")).useRouter = () => ({ push: mockPush } as any);

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("ユーザーID"), "admin");
    await user.type(screen.getByLabelText("パスワード"), "password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));
    expect(mockPush).toHaveBeenCalledWith("/map");
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
npx vitest run src/features/auth
```

Expected: FAIL (LoginForm not found)

- [ ] **Step 3: LoginForm 実装**

`src/features/auth/components/LoginForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId.trim() || !password.trim()) {
      setError("ユーザーIDとパスワードを入力してください");
      return;
    }

    // モックログイン：認証なし、常に成功
    router.push("/map");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          配送先マッピングシステム
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          ログインしてください
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="userId">ユーザーID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ユーザーID"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full">
            ログイン
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: ログインページ作成**

`src/app/(routes)/login/page.tsx`:
```tsx
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 5: トップページをログインにリダイレクト**

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 6: テスト実行（パス確認）**

```bash
npx vitest run
```

- [ ] **Step 7: コミット**

```bash
git add src/features/auth/ src/app/\(routes\)/login/ src/app/page.tsx
git commit -m "feat: add mock login page with TDD"
```

---

## Task 4: 地図画面をメインに + MapDropzone

**Files:**
- Create: `src/features/upload/components/__tests__/MapDropzone.test.tsx`
- Create: `src/features/upload/components/MapDropzone.tsx`
- Modify: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: MapDropzone テスト作成**

`src/features/upload/components/__tests__/MapDropzone.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapDropzone } from "../MapDropzone";

vi.mock("../hooks/useExcelParser", () => ({
  parseExcelFile: vi.fn(),
}));

vi.mock("@/features/assignment/hooks/useAutoAssign", () => ({
  useAutoAssign: () => ({
    processAll: vi.fn(),
  }),
}));

vi.mock("@/shared/store/deliveryStore", () => ({
  useDeliveryStore: Object.assign(
    (selector: any) => {
      const state = {
        mergeDeliveries: vi.fn(),
        setProcessing: vi.fn(),
        clearProcessing: vi.fn(),
        isProcessing: false,
        processingStep: "",
        deliveries: [],
      };
      return selector(state);
    },
    { getState: () => ({ deliveries: [] }) }
  ),
}));

describe("MapDropzone", () => {
  it("shows drop overlay when dragging a file over", () => {
    render(<MapDropzone />);
    const dropzone = screen.getByTestId("map-dropzone");

    fireEvent.dragOver(dropzone, {
      dataTransfer: { types: ["Files"] },
    });

    expect(screen.getByText(/Excelファイルをドロップ/)).toBeInTheDocument();
  });

  it("hides overlay when drag leaves", () => {
    render(<MapDropzone />);
    const dropzone = screen.getByTestId("map-dropzone");

    fireEvent.dragOver(dropzone, {
      dataTransfer: { types: ["Files"] },
    });
    fireEvent.dragLeave(dropzone);

    expect(screen.queryByText(/Excelファイルをドロップ/)).not.toBeInTheDocument();
  });

  it("shows processing state", () => {
    vi.mocked(await import("@/shared/store/deliveryStore")).useDeliveryStore = Object.assign(
      (selector: any) => {
        const state = {
          mergeDeliveries: vi.fn(),
          setProcessing: vi.fn(),
          clearProcessing: vi.fn(),
          isProcessing: true,
          processingStep: "住所を変換中...",
          deliveries: [],
        };
        return selector(state);
      },
      { getState: () => ({ deliveries: [] }) }
    );

    render(<MapDropzone />);
    expect(screen.getByText("住所を変換中...")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
npx vitest run src/features/upload/components/__tests__/MapDropzone
```

- [ ] **Step 3: MapDropzone 実装**

`src/features/upload/components/MapDropzone.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { useDeliveryStore } from "@/shared/store/deliveryStore";
import { parseExcelFile } from "../hooks/useExcelParser";
import { useAutoAssign } from "@/features/assignment/hooks/useAutoAssign";

export function MapDropzone() {
  const { mergeDeliveries, isProcessing, processingStep } = useDeliveryStore();
  const { processAll } = useAutoAssign();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.match(/\.xlsx?$/i)) {
        setError("Excelファイル（.xlsx/.xls）を選択してください");
        return;
      }

      useDeliveryStore.getState().setProcessing("Excel解析中...");
      const result = await parseExcelFile(file);

      if (!result.success) {
        setError(result.error);
        useDeliveryStore.getState().clearProcessing();
        return;
      }

      mergeDeliveries(result.deliveries);
      const allDeliveries = useDeliveryStore.getState().deliveries;

      // バックグラウンド処理：awaitしないのでUI操作をブロックしない
      processAll(allDeliveries).catch(() => {
        useDeliveryStore.getState().clearProcessing();
      });
    },
    [mergeDeliveries, processAll]
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

  return (
    <div
      data-testid="map-dropzone"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      className="relative h-full w-full"
    >
      {isDragOver && (
        <div className="absolute inset-0 z-[1000] bg-blue-500/20 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-8 py-6 shadow-lg text-center">
            <p className="text-xl font-bold text-blue-600">Excelファイルをドロップ</p>
            <p className="text-sm text-gray-500 mt-1">配送先データを読み込みます</p>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg px-6 py-3 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-3 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-blue-600">{processingStep}</span>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 rounded-lg px-6 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button
            className="ml-3 text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 地図ページにMapDropzone統合**

`src/app/(routes)/map/page.tsx` を修正：

1. 空データ時の「データをアップロード」リンクを削除。代わりに地図を表示し、中央に「Excelをドラッグ&ドロップしてください」のガイドを表示。
2. `<DeliveryMap />` を `<MapDropzone>` で囲む。
3. ヘッダーの「データ追加」ボタンにもファイル選択を追加。

地図画面の `<div className="flex-1">` 部分を以下に変更:
```tsx
<div className="flex-1 relative">
  <MapDropzone>
    <DeliveryMap />
    {deliveries.length === 0 && (
      <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
        <div className="bg-white/90 rounded-xl px-8 py-6 shadow-lg text-center">
          <p className="text-lg font-medium text-gray-700">Excelファイルをここにドラッグ&ドロップ</p>
          <p className="text-sm text-gray-500 mt-1">配送先データを読み込んでプロットします</p>
        </div>
      </div>
    )}
  </MapDropzone>
</div>
```

MapDropzone を children を受け取る形に修正（wrapperとして機能）。

- [ ] **Step 5: テスト実行**

```bash
npx vitest run
```

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

- [ ] **Step 7: コミット**

```bash
git add src/features/upload/components/MapDropzone.tsx src/features/upload/components/__tests__/ src/app/\(routes\)/map/
git commit -m "feat: add drag-and-drop Excel upload on map page with TDD"
```

---

## Task 5: バックグラウンドAI処理の改善

**Files:**
- Modify: `src/features/assignment/hooks/useAutoAssign.ts`
- Modify: `src/shared/store/deliveryStore.ts`
- Modify: `src/app/(routes)/map/page.tsx`

- [ ] **Step 1: Store に処理進捗の状態追加**

`src/shared/store/deliveryStore.ts` に追加:
```typescript
// State に追加
geocodedCount: number;
totalToGeocode: number;

// Actions に追加
setGeocodeProgress: (done: number, total: number) => void;
```

`partialize` には含めない（セッション中のみ）。

- [ ] **Step 2: useAutoAssign をバックグラウンド対応に修正**

`src/features/assignment/hooks/useAutoAssign.ts`:

`processAll` を修正して:
1. ジオコーディング結果を段階的に store に反映（ピンが順次表示される）
2. `setProcessing` でステップ表示を更新
3. エラーでもUIがクラッシュしない

```typescript
const processAll = useCallback(async (newDeliveries: Delivery[]) => {
  let items = newDeliveries;

  // ジオコーディング（結果を即座に反映）
  items = await runGeocoding(items);
  setDeliveries(items); // ジオコーディング完了分を先に表示

  // 自動振り分け
  items = await runAssignment(items);
  setDeliveries(items);

  clearProcessing();
}, [runGeocoding, runAssignment, setDeliveries, clearProcessing]);
```

- [ ] **Step 3: 地図画面の処理中UIを改善**

`src/app/(routes)/map/page.tsx` で MapDropzone の `isProcessing` 表示がフローティングで表示されるようにする（Task 4 で実装済み）。追加で、ヘッダーにも小さな処理インジケーターを表示。

- [ ] **Step 4: テスト実行 + ビルド確認**

```bash
npx vitest run && npm run build
```

- [ ] **Step 5: コミット**

```bash
git add src/features/assignment/ src/shared/store/ src/app/\(routes\)/map/
git commit -m "feat: background AI processing with progressive pin display"
```

---

## Task 6: 最終結合テスト + デプロイ

- [ ] **Step 1: 全テスト実行**

```bash
npx vitest run
```

全テストがパスすることを確認。

- [ ] **Step 2: E2Eフロー確認**

1. `http://localhost:3000` → ログイン画面
2. ID/パスワード入力 → 「ログイン」→ 地図画面（空）
3. 地図画面にExcelをドラッグ&ドロップ
4. フローティングで「Excel解析中... → 住所変換中... → 自動振り分け中...」表示
5. 処理中も地図のパン・ズーム操作が可能
6. ジオコーディング完了分から順次ピンが表示される
7. 全処理完了で色分けピンが表示

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット + プッシュ + デプロイ**

```bash
git add -A
git commit -m "feat: complete demo UX flow (login → map → drag-drop → background AI)"
git push
vercel --prod
```
