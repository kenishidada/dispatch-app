# 配送振り分け精度改善 + Railway 移行 設計書

- 作成日: 2026-04-18
- 改訂: 2026-04-18（コードレビュー反映）
- 起点: 2026-04-17 打ち合わせ（先方との配送ルート自動振り分けシステムの課題と改善）
- 対象アプリ: dispatch-app

## 0. 参照ドキュメント

`AGENTS.md` の指示に従い、Next.js 16 のドキュメントを `node_modules/next/dist/docs/` から確認した。

| 参照箇所 | パス | 確認内容 |
|---|---|---|
| Route Handlers | `01-app/03-api-reference/03-file-conventions/route.md` | `runtime='nodejs'` がデフォルト、Railway 上で標準動作 |
| `maxDuration` | `01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md` | プラットフォーム依存設定（Vercel が使用、Railway は無視）。Railway 移行で削除して問題なし |
| 破壊的変更 | `route.md` の Version History | v15.0.0-RC で `context.params` が Promise 化。本アプリの Route Handler は使用していないため影響なし |

## 1. 背景

2026-04-17 の打ち合わせで以下の課題が指摘された:

1. 同じ届先住所の伝票が複数行として扱われ、件数が水増しされる（例: 153件のはずが277件と表示）
2. 容積/重量/件数の上限がAI判断に組み込まれていない
3. 「2tから組み立てて、残りを軽に」という人間の手順がAIに反映されていない
4. AIが不確実な判断でも無理に振ってしまう
5. その日の稼働ドライバー数が日替わりだが、固定ドライバー前提で動いている
6. Vercel デプロイでAI処理がタイムアウトする

打ち合わせ録 Speaker 2 の発言「振り分けさえできればあとは人間が手直しでOK」をゴールとし、振り分け精度の向上を最優先とする。

## 2. スコープ

| ID | 項目 | 含む |
|---|---|---|
| A | 住所重複の集約 | ✓ |
| B | 車両スペックをAI判断に組み込み | ✓ |
| C | 「2tから組む」順序の決定論+AI 2段階パイプライン | ✓ |
| D | 未割り当て機能（AIが不確実なものだけ） | ✓ |
| E | 稼働台数のアップロード時入力ダイアログ | ✓ |
| F | 複数ファイルの追加アップロード | ✗（次フェーズ） |
| G | PDF出力結果からのAI学習ループ | ✗（次フェーズ） |
| H | 住所文字列の正規化 | ✓（軽い正規化のみ） |
| I | Vercel → Railway 移行 | ✓ |

## 3. 主な決定事項

| 項目 | 結論 | 根拠 |
|---|---|---|
| 重複集約キー | 届先住所を軽く正規化（全角→半角、スペース統一）した文字列 | 実データ `戸塚0417 (1).xlsx` 検証で 277行 → 152件に集約。先方発言「本来153件」と1件差は表記揺れ未解決の残件と推定（§6.3 検証ログ参照） |
| データ構造 | `Delivery` 1件に `slips: SlipDetail[]` を内包（パース時集約） | 既存ロジック影響最小、現場運用と一致 |
| 振り分け先 | `Driver` を完全削除し `Course`（軽1〜N、2t1〜M）に置換 | 「誰が担当するかは運用カバー」方針 |
| 車両スペック | `vehicleType` ごとに最大運用値1セット | 細かい回戦管理は不要、シンプル化 |
| 振り分けロジック | 案B改（決定論＋AI 2段階、AI呼び出しは車種ごと1バッチ） | 精度重視、コスト・時間を既存と同等以下に維持 |
| 未割り当て条件 | AIが不確実と判断したものだけ | 人間が確認すべき本当のグレーゾーンに絞る |
| 上限超過の扱い | 警告のみ、割当は変更しない（**実運用後に再評価**） | 打ち合わせ録 Speaker 2 の最終発言「振り分けさえできればあとは人間が手直しでOK」と整合。自動分散は実運用で必要性が判明してから検討 |
| ログ表示 | レベル2（振り分け全体ログ＋各レコード理由） | 設定チューニングの判断材料 |
| 旧データ移行 | `drivers → courses` 変換、`areaImage`/`areaDescription`/`areaRules` 保持 | 先方は既に運用を開始しており設定情報を破棄してはいけない（レビュー指摘 M2） |
| Railway デプロイ方式 | Nixpacks 自動検出 | 設定不要 |
| Node.js バージョン | `engines: "20.x"` を `package.json` に明記 | ビルド再現性 |
| Vercel `maxDuration` | 削除 | Railway は当該設定を無視。Next.js 16 ドキュメント確認済 |

## 4. データモデル

### 4.1 型定義の変更（`src/shared/types/delivery.ts`）

#### 新規型

```ts
export type Course = {
  id: string;                    // "light-1" 等
  name: string;                  // "軽1", "2t1"
  vehicleType: "light" | "2t";
  color: string;
  defaultRegion: string;         // 担当エリア説明文（プロンプト用）
};

export type VehicleSpec = {
  vehicleType: "light" | "2t";
  maxVolume: number;             // L
  maxWeight: number;             // kg
  maxOrders: number;             // 件数（集約後）
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
```

#### 変更された型

```ts
export type Delivery = {
  id: string;
  destinationName: string;
  address: string;               // 正規化済み（集約キー）
  rawAddress: string;            // 元の住所文字列
  destinationCode: number;
  addressCode: number;
  deliveryDate: string;
  shippingCategory: string;
  // 集約合計
  packageCount: number;
  volume: number;
  actualWeight: number;
  slips: SlipDetail[];
  // 振り分け
  lat: number | null;
  lng: number | null;
  courseId: string | null;       // 旧 driverName
  colorCode: string | null;
  isUndelivered: boolean;
  memo: string;
  assignReason: string;
  unassignedReason: string;      // 新規
  geocodeStatus: GeoCodeStatus;
};

export type AreaRule = {
  id: string;
  region: string;
  courseId: string;              // 旧 driverName + vehicleType を統合
};
```

#### 削除される型

- `Driver`
- `DEFAULT_DRIVERS`
- `AreaRule.driverName`、`AreaRule.vehicleType`

#### デフォルト値

```ts
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
  { vehicleType: "2t",    maxVolume: 10000, maxWeight: 2000, maxOrders: 10 },
];
```

### 4.2 Zustand store（`src/shared/store/deliveryStore.ts`）

#### state

```ts
type DeliveryStore = {
  // 永続化
  courses: Course[];
  vehicleSpecs: VehicleSpec[];
  areaRules: AreaRule[];
  areaImage: string | null;
  areaDescription: string;
  // 揮発
  deliveries: Delivery[];
  activeCourseIds: string[];        // 当日稼働コースID
  assignmentLog: AssignmentLogEntry[];
  capacityWarnings: CapacityWarning[];
  selectedDeliveryId: string | null;
  selectedDeliveryIds: Set<string>;
  courseFilter: Set<string> | null; // 旧 driverFilter
  uploadedFileName: string;
  isProcessing: boolean;
  processingStep: string;
};
```

#### マイグレーション（v1 → v2）

```ts
persist(
  (set, get) => ({ ... }),
  {
    name: "delivery-store",
    version: 2,
    partialize: (s) => ({
      courses: s.courses,
      vehicleSpecs: s.vehicleSpecs,
      areaRules: s.areaRules,
      areaImage: s.areaImage,
      areaDescription: s.areaDescription,
    }),
    migrate: (persistedState: unknown, version: number) => {
      if (!persistedState || typeof persistedState !== 'object') return persistedState;
      const s = persistedState as Record<string, unknown>;
      if (version < 2) {
        // 旧 drivers → courses 変換、設定情報は保持
        const oldDrivers = (s.drivers as Array<{ name: string; color: string; vehicleType: 'light' | '2t' }> | undefined) ?? [];
        const courses: Course[] = oldDrivers.length > 0
          ? oldDrivers.map((d, i) => ({
              id: `${d.vehicleType === '2t' ? 'truck' : 'light'}-${i + 1}`,
              name: d.name,                  // 旧名前を保持（例: "コース1（軽）"）
              vehicleType: d.vehicleType,
              color: d.color,
              defaultRegion: '',
            }))
          : DEFAULT_COURSES;
        const oldRules = (s.areaRules as Array<{ id: string; region: string; driverName: string }> | undefined) ?? [];
        const areaRules: AreaRule[] = oldRules.map(r => {
          const matched = courses.find(c => c.name === r.driverName);
          return { id: r.id, region: r.region, courseId: matched?.id ?? courses[0]?.id ?? '' };
        });
        return {
          courses,
          vehicleSpecs: DEFAULT_VEHICLE_SPECS,
          areaRules,
          areaImage: s.areaImage ?? null,
          areaDescription: s.areaDescription ?? '',
        };
      }
      return persistedState;
    },
  }
);
```

**ポイント**:
- 旧 `drivers` 配列を新 `courses` に変換、コース名は旧名前を保持して現場の混乱を防ぐ
- `areaImage`（区割り図）、`areaDescription`（エリアルール説明）、`areaRules` は破棄せず保持
- `vehicleSpecs` は新規追加項目なのでデフォルト値で埋める

## 5. 振り分けパイプライン

### 5.1 全体フロー

```
入力: deliveries (集約済み152件), activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription
   ↓
段階0: 画像→テキストルール変換（キャッシュあり）
   ↓
段階1: 大口荷物の抽出（決定論）
   ↓
段階2: 地理クラスタリング（決定論：DBSCAN）→ クラスタ情報を AI ヒントとして使う
   ↓
段階3: 大口の2tコース割り当て（AI 1バッチ呼び出し）
   ↓
段階4: 軽荷物の軽コース割り当て（AI 1〜2バッチ呼び出し）
   ↓
段階5: 上限チェック＆警告生成（決定論）
   ↓
段階6: AIレビュー（既存改良。地理整合性のみ確認）
   ↓
出力: assignments[], assignmentLog[], capacityWarnings[]
```

**AI 呼び出し回数の見積もり**（`戸塚0417 (1).xlsx` 152件で試算）:

| 段階 | 既存 | 新設計（修正後） |
|---|---|---|
| 段階0（画像変換） | 1回 | 0〜1回（キャッシュヒット時0） |
| 段階3（2t割当） | バッチ込み | 1回（大口14件） |
| 段階4（軽割当） | バッチ込み | 1〜2回（軽138件、100件/バッチ） |
| 段階6（レビュー） | 1回 | 1回 |
| **合計** | **3〜4回** | **3〜5回** |

レビュー指摘 M1 を反映し、当初検討した「クラスタ単位呼び出し（20-40回）」を廃止。AIには「クラスタID付きの全件リスト」を渡し、AIに地理整合性を考慮させる方式に変更。これで既存と同等のコスト・速度を維持しつつ、地理整合性が向上する。

### 5.2 各段階の詳細

#### 段階0: 画像ルールキャッシュ

`localStorage` に `area-rules-${imageHash}-${coursesHash}` で保存。
- `imageHash` = SHA-256(`areaImage`)
- `coursesHash` = SHA-256(JSON.stringify(courses.map(c => `${c.id}:${c.name}`)))

コース構成が変わったらキャッシュ無効化（レビュー指摘 N2 反映）。

#### 段階1: 大口抽出（決定論）

```ts
function getTruckThreshold(vehicleSpecs: VehicleSpec[]): number {
  const lightSpec = vehicleSpecs.find(s => s.vehicleType === 'light');
  // 軽の単発容積上限（最大運用値 ÷ 想定回戦数3）
  return lightSpec ? Math.floor(lightSpec.maxVolume / 3) : 1500;
}

const TRUCK_THRESHOLD = getTruckThreshold(vehicleSpecs);
const truckCandidates = deliveries.filter(d => d.volume >= TRUCK_THRESHOLD);
const lightCandidates = deliveries.filter(d => d.volume < TRUCK_THRESHOLD);
```

レビュー指摘 S2 を反映し、`vehicleSpecs` から導出する設計に変更。デフォルト値（軽 maxVolume=4500L）の場合、閾値は 1500L となる。

ジオコーディング失敗（`lat/lng=null`）は両側から除外し、未割り当て候補に。

#### 段階2: 地理クラスタリング（決定論）

新規ファイル `src/lib/clustering.ts` に DBSCAN 実装。

- `eps = 5km`（環境変数 `NEXT_PUBLIC_DBSCAN_EPS_KM` で上書き可能、デフォルト 5）
- `minPts = 2`（環境変数 `NEXT_PUBLIC_DBSCAN_MIN_PTS` で上書き可能、デフォルト 2）
- ノイズ点（cluster_id=-1）は単独クラスタとして扱う
- 結果は `Map<deliveryId, clusterId>` として段階3-4 のプロンプトに渡す

レビュー指摘 N1 を反映し、初期は環境変数で調整可能に。

#### 段階3: 2tコース割り当て（AI 1バッチ）

大口候補の全件を1回の API 呼び出しで処理。プロンプトに以下を含める:

```
あなたは配送ルート振り分けの専門家です。
以下の大口荷物（容積 1500L 以上）を、稼働中の2tコースに割り当ててください。

【稼働中の2tコース】
- 2t1: 担当エリア「横浜北部・川崎」
- 2t2: 担当エリア「横浜南部・湘南」

【車両スペック】
2tトラック: 1台あたり容積上限 10000L、重量上限 2000kg、件数上限 10件

【エリアルール】
（テキスト + 画像から抽出したルール）

【判断手順】
1. 同じクラスタID の荷物は地理的に近接している。可能な限り同じコースに割り当てる
2. 各2tコースの容積/重量/件数の上限を超えないよう調整
3. エリアルールに該当しない、またはどのコースに振るべきか判断できない荷物は driverName="" で返し、reason に "未割り当て: <理由>" と書く

【荷物リスト（クラスタID付き）】
[{ "id": "...", "address": "...", "volume": ..., "weight": ..., "lat": ..., "lng": ..., "clusterId": 0 }, ...]

【出力】
{ "assignments": [{ "deliveryId": "...", "driverName": "2t1", "reason": "..." }] }
```

#### 段階4: 軽コース割り当て（AI 1〜2バッチ）

段階3と同様の構造で、軽コース対象。100件超のバッチ分割は既存と同じ。

#### 段階5: 上限チェック＆警告（決定論）

```ts
function checkCapacity(
  assignments: AssignmentResult[],
  deliveries: Delivery[],
  courses: Course[],
  vehicleSpecs: VehicleSpec[],
  activeCourseIds: string[]
): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  const assignMap = new Map(assignments.map(a => [a.deliveryId, a.courseId]));
  for (const courseId of activeCourseIds) {
    const course = courses.find(c => c.id === courseId);
    if (!course) continue;
    const spec = vehicleSpecs.find(s => s.vehicleType === course.vehicleType);
    if (!spec) continue;
    const assigned = deliveries.filter(d => assignMap.get(d.id) === courseId);
    const totalVolume = assigned.reduce((s, d) => s + d.volume, 0);
    const totalWeight = assigned.reduce((s, d) => s + d.actualWeight, 0);
    const totalOrders = assigned.length;
    if (totalVolume > spec.maxVolume) warnings.push({
      courseId, type: 'volume', current: totalVolume, limit: spec.maxVolume,
      message: `${course.name}: 容積 ${totalVolume}/${spec.maxVolume}L (${totalVolume - spec.maxVolume}L 超過)`,
    });
    if (totalWeight > spec.maxWeight) warnings.push({...});
    if (totalOrders > spec.maxOrders) warnings.push({...});
  }
  return warnings;
}
```

**割り当てを変更しない**。実運用で「自動分散が必要」と判明したら次フェーズで追加（§11）。

#### 段階6: AIレビュー（地理整合性のみ）

責務を「地理的に明らかにおかしい割当の修正」に限定。未割り当て判定は段階3-4 でのみ行う（レビュー指摘 S4 反映）。

```
【指示】
- 各配送先の住所と割り当てコースを確認
- 地理的に明らかに別エリアに属する配送先があれば、近隣コースに修正
- 修正不要なものはスキップ
- 未割り当てのもの（driverName="" のもの）はそのまま

{ "corrections": [{ "deliveryId": "...", "newDriverName": "...", "reason": "..." }] }
```

### 5.3 振り分けログ

各段階の終わりに `AssignmentLogEntry` を追加。例:

```
[段階1: 大口抽出] 1500L以上: 14件、軽対象: 138件
[段階2: 地理クラスタリング] eps=5km, minPts=2 / 2t用: 4クラスタ, 軽用: 12クラスタ, 外れ値: 6件
[段階3: 2t割り当て] 2t1=8件, 2t2=6件, 未割り当て=0件 (AI 1.2秒)
[段階4: 軽割り当て] 軽1=42件, 軽2=48件, 軽3=44件, 未割り当て=4件 (AI 2.8秒, 2バッチ)
[段階5: 上限チェック] 警告 1件: 軽2 重量超過 (1180/1050kg)
[段階6: AIレビュー] 修正 3件 (AI 1.5秒)
```

### 5.4 API契約

```ts
// POST /api/assign リクエスト
{
  deliveries: Delivery[],
  courses: Course[],
  activeCourseIds: string[],
  vehicleSpecs: VehicleSpec[],
  areaRules: AreaRule[],
  areaImage: string | null,
  areaDescription: string,
}

// レスポンス
{
  assignments: { deliveryId: string, courseId: string | null, reason: string, unassignedReason: string }[],
  assignmentLog: AssignmentLogEntry[],
  capacityWarnings: CapacityWarning[],
}
```

## 6. 住所重複集約（Excel パース時）

### 6.1 正規化ルール

```ts
function normalizeAddress(s: string): string {
  return s
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ー－―‐]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
```

### 6.2 集約ロジック

`useExcelParser.ts` 内で:

1. 各行をパースして「生伝票データ」を作る
2. `normalizeAddress(届先住所)` をキーにグループ化
3. 各グループを 1つの `Delivery` に集約:
   - 集計値（`packageCount` / `volume` / `actualWeight`）= 全伝票合計
   - 代表値（`destinationName` / `destinationCode` / `addressCode` / `deliveryDate` / `shippingCategory`）= グループ内最初の伝票
   - `slips` = グループ内全伝票の `SlipDetail[]`
   - `address` = 正規化後文字列、`rawAddress` = 最初の生文字列

### 6.3 検証

実データ `戸塚0417 (1).xlsx` で 277行 → **152件** に集約されることを Vitest で検証。

**先方発言「本来153件」との1件差について**: 実データで生文字列 152、正規化後 152 と変化なし。建物名除去（最初の空白で切る）すると151件。先方の153件は記憶ベースの推定値であり、実データの152件が正しい集約結果と判断する。

合計値検証（実測値）:
- 合計容積: 65,483 L
- 合計重量: 15,702 kg
- 大口（≥1500L）: **9件**
- 軽対象（<1500L）: **143件**

**閾値導出**: トラック判定閾値 = `light maxVolume / 3 = 4500 / 3 = 1500L`。旧 `gemini.ts` は `>= 1000L` をハードコードしており（→ 14件）、本設計で `vehicleSpec` ベースに整合させた。

## 7. UI/UX 変更

### 7.1 設定画面 `/settings`

3カード構成:

1. **車両スペック**: 軽/2t それぞれの容積/重量/件数の上限を編集
2. **コース管理**: 旧ドライバー管理。`Course` の追加/編集/削除、`defaultRegion` 列を追加
3. **エリア設定**: 区割り図画像、エリアルールテキスト、`AreaRule`（地域→コース）の表

### 7.2 アップロードフロー

```
Excel ドロップ
  → パース＋集約（裏側）
  → プレビュー＋稼働台数入力（1画面に統合）
      件数/容積/重量サマリ + 軽◯台/2t◯台入力 + 容量目安表示
  → ジオコーディング
  → 振り分け実行
  → 地図画面 + ログ + 警告
```

レビュー指摘 N4 を反映し、プレビューと稼働台数入力を1画面に統合。

### 7.3 地図画面

既存に追加:

- **コースフィルタ**: `DriverFilterBar` を `CourseFilterBar` にリネーム
- **警告パネル**: `capacityWarnings` を表示、クリックで該当コースをハイライト
- **ログパネル**: `assignmentLog` を時系列表示、コピー可能
- **未割り当てグループ**: サイドパネルに表示、灰色ピン
- **振り分けやり直しボタン**: 設定変更後に再実行（ファイル再アップロード不要）

### 7.4 ピン詳細パネル

`PinDetailPanel`:

- 集約後の伝票内訳テーブル（伝票No、個口数、容積、重量）
- ドライバー再アサイン → コース再アサイン

### 7.5 PDF 出力

`DeliveryReport`:

- `driverName` → `course.name` に置換
- 警告がある場合、先頭ページに「⚠ 上限超過コースあり」サマリ追加

## 8. ファイル変更マップ

### 新規

| ファイル | 内容 |
|---|---|
| `src/lib/clustering.ts` | DBSCAN クラスタリング、`haversine` 距離関数 |
| `src/features/upload/components/CapacityInputDialog.tsx` | 稼働台数入力ダイアログ（プレビューと統合） |
| `src/features/assignment/components/AssignmentLogPanel.tsx` | 振り分けログ表示 |
| `src/features/assignment/components/CapacityWarningPanel.tsx` | 上限超過警告表示 |
| `src/features/assignment/components/RerunButton.tsx` | 振り分けやり直しボタン |
| `src/features/settings/components/VehicleSpecEditor.tsx` | 車両スペック編集UI |
| `src/features/settings/components/CourseEditor.tsx` | コース管理UI（旧 DriverEditor） |
| `src/test/mocks/delivery.ts` 拡張 | 新型のモックデータ |

### 改訂

| ファイル | 変更内容（具体メソッド/関数レベル） |
|---|---|
| `src/shared/types/delivery.ts` | `Course`/`VehicleSpec`/`SlipDetail`/`AssignmentLogEntry`/`CapacityWarning` 追加、`Delivery`/`AreaRule` 改訂、`Driver` 削除、`DEFAULT_COURSES`/`DEFAULT_VEHICLE_SPECS` 追加 |
| `src/shared/store/deliveryStore.ts` | state 全面改訂。`drivers` → `courses`、`vehicleSpecs` 追加、`activeCourseIds`/`assignmentLog`/`capacityWarnings` 追加、`driverFilter` → `courseFilter`。メソッド: `setDrivers` → `setCourses`、`updateDriverAssignment` → `updateCourseAssignment`、`bulkAssignDriver` → `bulkAssignCourse`、`toggleDriverFilter` → `toggleCourseFilter`、`setActiveCourseIds`/`setAssignmentLog`/`setCapacityWarnings`/`clearAssignmentResults` を新規追加。マイグレーション関数 v1→v2 を実装 |
| `src/features/upload/hooks/useExcelParser.ts` | `normalizeAddress` 関数追加、パース結果を住所キーで集約、`SlipDetail[]` を構築 |
| `src/features/upload/hooks/__tests__/useExcelParser.test.ts` | 集約ロジックのテスト追加 |
| `src/lib/gemini.ts` | パイプライン全面改訂。`getTruckThreshold` 追加、`autoAssign` を5段階パイプライン化、`reviewAndFix` の責務を地理整合性のみに絞る、画像キャッシュキーに `coursesHash` 追加 |
| `src/app/api/assign/route.ts` | API契約変更（`courses`/`activeCourseIds`/`vehicleSpecs` 受信、`assignmentLog`/`capacityWarnings` 返却）、`maxDuration = 300` 削除 |
| `src/features/settings/components/AreaRuleEditor.tsx` | 3カードに分割。`VehicleSpecEditor` `CourseEditor` を呼び出す形に。`AreaRule` の `driverName`/`vehicleType` 編集を `courseId` 単一選択に変更 |
| `src/features/map/components/PinDetailPanel.tsx` | 伝票内訳テーブル表示、`driverName` ドロップダウンを `courseId` に変更 |
| `src/features/map/components/DeliveryListPanel.tsx` | 未割り当てグループ表示（最上部固定）、各レコードに `unassignedReason` 表示 |
| `src/features/map/components/DeliveryPin.tsx` | `colorCode === null` のとき灰色ピン |
| `src/features/map/components/DeliveryMap.tsx` | `courseFilter` に追従、`courseId === null` の灰色ピン表示 |
| `src/features/map/hooks/useMapInteraction.ts` | `driverFilter` → `courseFilter` に追従 |
| `src/features/assignment/components/DriverFilterBar.tsx` | ファイル名変更 → `CourseFilterBar.tsx`、`driverName` → `courseId` 参照 |
| `src/features/assignment/components/DriverSummary.tsx` | ファイル名変更 → `CourseSummary.tsx`、コース集計に上限値の表示追加（例: `軽1: 容積 3200/4500L`） |
| `src/features/assignment/hooks/useAutoAssign.ts` | API契約変更に追従、レスポンスから `assignmentLog`/`capacityWarnings` を store に格納 |
| `src/features/pdf/components/DeliveryReport.tsx` | `driverName` 参照を `courseId` 経由で `course.name` に変更、警告サマリ追加 |
| `src/features/pdf/hooks/usePdfGenerate.ts` | 引数を `courses` ベースに変更 |
| `src/app/(routes)/upload/page.tsx` | プレビュー＋稼働台数入力 UI を追加 |
| `src/app/(routes)/settings/page.tsx` | 新3カード構成に追従 |
| `src/app/(routes)/map/page.tsx` | サイドパネルに `AssignmentLogPanel`/`CapacityWarningPanel`/`RerunButton` を配置 |
| `src/app/(routes)/view/[sessionId]/page.tsx` | 共有ビュー側もコース概念に追従 |
| `src/features/map/components/SharedMap.tsx` | コース表示に追従 |
| `package.json` | `engines: "20.x"` 追加 |

### 削除

| 対象 | 理由 |
|---|---|
| `Driver` 型と関連コード | `Course` に置換 |
| `DEFAULT_DRIVERS` | `DEFAULT_COURSES` に置換 |
| `maxDuration = 300` | Vercel 専用、Railway では不要（Next.js 16 ドキュメント確認済） |

## 9. Railway 移行

### 9.1 移行作業チェックリスト

| # | 作業 | 担当 |
|---|---|---|
| 1 | Railway アカウント / プロジェクト作成 | ユーザー |
| 2 | GitHub リポジトリを Railway に接続 | ユーザー |
| 3 | Nixpacks 自動ビルドの動作確認 | 自動 |
| 4 | Variables に `GEMINI_API_KEY` 設定（既存値そのまま） | ユーザー |
| 5 | コード側 `maxDuration` 削除、`engines` 追加 | 開発 |
| 6 | 初回デプロイ、Railway URL で動作確認 | ユーザー |
| 7 | 2-3日安定稼働確認 | ユーザー |
| 8 | Vercel プロジェクト削除 | ユーザー |

### 9.2 環境変数

| キー | 用途 | 設定方法 |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API（既存値） | Vercel から手動コピー |
| `NEXT_PUBLIC_DBSCAN_EPS_KM` | DBSCAN 半径（任意、デフォルト5） | 必要時のみ設定 |
| `NEXT_PUBLIC_DBSCAN_MIN_PTS` | DBSCAN 最小点数（任意、デフォルト2） | 必要時のみ設定 |
| `PORT` | HTTP リスニング | Railway 自動注入、設定不要 |

### 9.3 ロールバック手順

Railway で問題が発生した場合の Vercel 切り戻し:

1. Vercel プロジェクトを削除しない期間（移行後 2-3日）は両方稼働
2. DNS を使う場合は Cloudflare 等で切替先を制御
3. 環境変数バックアップは Vercel ダッシュボードからエクスポート、またはローカル `.env.local` に保管
4. ロールバック手順:
   - Railway デプロイを停止または環境変数を変更
   - Vercel デプロイを再有効化
   - 必要に応じてローカル `.env.local` の値を Vercel に再設定

### 9.4 リスクと対策

| リスク | 対策 |
|---|---|
| GEMINI_API_KEY 設定漏れ | デプロイ後に `/upload` で動作確認、Railway ログ目視 |
| ビルド失敗 | `engines: "20.x"` 明示でバージョン固定 |
| ロールバック不可 | §9.3 参照。Railway 安定稼働確認後に Vercel 削除 |
| Next.js 16 の Route Handler 互換性 | 既存コードは `context.params` 不使用、影響なし（§0 参照） |

## 10. テスト方針

| テスト | 対象 | 方法 |
|---|---|---|
| 住所正規化 | `normalizeAddress` | Vitest 単体テスト（全角数字/英字/ハイフン/空白の各ケース） |
| Excel 集約 | `parseExcelFile` | 実データ `戸塚0417 (1).xlsx` で 277行→152件、合計値（容積65,483L、重量15,702kg）を検証 |
| DBSCAN | `dbscan` | 既知の点群（直線配置、円配置、外れ値あり）でクラスタ数とノイズ点を検証 |
| 大口閾値 | `getTruckThreshold` | 各種 vehicleSpecs 入力で期待閾値を返すか検証 |
| 上限チェック | `checkCapacity` | 既知の入力で warning 配列を検証（容積/重量/件数の各ケース） |
| マイグレーション | `migrate` 関数 | v1 形式のモック state を入力し、v2 への変換結果を検証（`drivers→courses`、`areaRules.driverName→courseId`、`areaImage`/`areaDescription` 保持） |
| パイプライン統合 | `autoAssign` | モック AI レスポンスで段階フローを検証、ログと警告が正しく生成されるか |
| **精度ゴールデンテスト** | パイプライン全体 | 戸塚0417 のデータと「先方が手で振り分けた正解データ」（次回打ち合わせで取得）を比較し、一致率を測定。一致率の閾値は実データ取得後に決定 |
| **未割り当て率 KPI** | パイプライン全体 | 戸塚0417 で未割り当て件数を測定。打ち合わせの「10件以内」を目標値とし、超過時はテスト警告 |

## 11. 想定されるリスク・将来課題

| 項目 | 内容 | 対応時期 |
|---|---|---|
| 「物流ネット」付加文字列の表記揺れ | 今回データでは観測されず、対応保留 | 発生時に対処 |
| F: 複数ファイル追加アップロード | 8月開始の新規取引先で必要になる可能性 | 次フェーズ |
| G: 学習ループ | 過去の振り分け結果から精度向上 | 中長期 |
| 上限超過時の自動分散（S5 再評価） | 警告のみ運用で人間判断を尊重。実運用で「自動分散が必要」と判明したら段階5 を拡張 | 実運用 1ヶ月後に評価 |
| DBSCAN パラメータの妥当性 | 5km/2点が適切か実データで検証必要。環境変数で調整可能 | 実装後にチューニング |
| AI のクラスタヒント精度 | クラスタIDをプロンプトに渡すだけで AI が正しく解釈するか不確実。必要なら段階3-4 を「クラスタを巡る順序」を明示する形に拡張 | 実運用後に評価 |
| 「コース」と「ドライバー」用語 | 先方は両方の言葉を混在使用。UI 文言が現場の言葉遣いに合うか先方確認が必要 | UI 実装後に先方レビュー |
| `defaultRegion` 初期値 | デフォルトで空文字、初期セットアップでユーザーが入力する負担あり | 初回利用時のオンボーディング案内で対応 |
| 戸塚以外のデータでの集約精度 | 表記揺れが多いデータでは152件のような綺麗な集約にならない可能性 | 別日のデータで継続検証 |

## 12. 実装後のレビューサイクル

打ち合わせ録の最後で先方から以下の流れが提示されている:

> 「石田さんが新たに作っていただいたものを、まあ1週間と言わずに、もう3日間ぐらいで、だいたいできてるものを入れて確認はできるので。まあ1日2日で私も多分できると思うので。そこでちょっと調整できたら、あのズームできますかって私が入れて、村井さんとすり合わせできればなっていう流れ」

このため:

1. 実装完了 → ユーザー（社内）が3日程度でデータを入れて検証
2. 検証結果をもとに ZoomMTG（村井さん同席）で先方とすり合わせ
3. 必要に応じて DBSCAN パラメータや AI プロンプトを微調整
