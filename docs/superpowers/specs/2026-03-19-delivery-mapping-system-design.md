# 配送先マッピングシステム 設計書

## 概要

荷主から届くExcelの配送先リストをアップロードし、地図上にプロット。Gemini Flash LLMによる自動ドライバー振り分けと、管理者による手動調整を経て、ドライバー別PDFを出力するWebアプリケーション。

**プロトタイプ方針**: DB不要、ブラウザstate管理、Vercelデプロイ対応。

## ユーザー

- **主要ユーザー**: 配車を組む事務所の管理者
- **参照ユーザー**: 配達ドライバー（読み取り専用ビュー）
- **スキルレベル**: ITに不慣れな方でも使える直感的なUI

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| スタイリング | Tailwind CSS + shadcn/ui |
| 状態管理 | Zustand |
| 地図 | react-leaflet + OpenStreetMap（無料） |
| Excel解析 | xlsx |
| PDF生成 | @react-pdf/renderer |
| LLM | Gemini Flash (@google/generative-ai SDK) |
| ジオコーディング | 国土地理院 geocoding API（無料） |
| デプロイ | Vercel |

## アーキテクチャ

```
[ブラウザ]
  ├─ アップロード画面
  ├─ 地図画面（メイン）
  ├─ 地域割り設定画面
  └─ ドライバー参照ビュー（読み取り専用）

[Next.js API Routes]
  ├─ /api/upload     … Excel解析 → 配送データ抽出
  ├─ /api/geocode    … 住所 → 緯度経度変換（国土地理院API）
  ├─ /api/assign     … Gemini Flashで地域割り自動振り分け
  └─ /api/pdf        … PDF生成

[外部サービス]
  ├─ 国土地理院 geocoding API（無料）
  ├─ OpenStreetMap タイル（無料）
  └─ Gemini Flash API
```

## feature別ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        … ランディング → アップロードへ誘導
│   ├── api/
│   │   ├── geocode/route.ts
│   │   ├── assign/route.ts
│   │   └── pdf/route.ts
│   └── (routes)/
│       ├── upload/page.tsx
│       ├── map/page.tsx
│       ├── settings/page.tsx           … 地域割り設定
│       └── view/[sessionId]/page.tsx   … ドライバー参照ビュー
├── features/
│   ├── upload/
│   │   ├── components/
│   │   │   └── UploadDropzone.tsx
│   │   ├── hooks/
│   │   │   └── useExcelParser.ts
│   │   └── types.ts
│   ├── map/
│   │   ├── components/
│   │   │   ├── DeliveryMap.tsx
│   │   │   ├── DeliveryPin.tsx
│   │   │   ├── PinDetailPanel.tsx
│   │   │   └── GeocodingErrorList.tsx  … プロット失敗データ表示
│   │   ├── hooks/
│   │   │   └── useMapInteraction.ts
│   │   └── types.ts
│   ├── assignment/
│   │   ├── components/
│   │   │   ├── AssignmentPanel.tsx
│   │   │   └── DriverFilterBar.tsx
│   │   ├── hooks/
│   │   │   └── useAutoAssign.ts
│   │   └── types.ts
│   ├── pdf/
│   │   ├── components/
│   │   │   └── DeliveryReport.tsx
│   │   └── hooks/
│   │       └── usePdfGenerate.ts
│   └── settings/
│       ├── components/
│       │   └── AreaRuleEditor.tsx       … 地域割りルール編集
│       └── types.ts
├── shared/
│   ├── components/
│   ├── store/
│   │   └── deliveryStore.ts
│   └── types/
│       └── delivery.ts
└── lib/
    ├── geocoding.ts
    └── gemini.ts
```

## データモデル

```typescript
type Delivery = {
  id: string
  factoryName: string
  carrierCode: number
  carrierName: string
  destinationCode: number
  destinationName: string
  packageCount: number
  quantity: number
  caseCount: number
  assortQuantity: number
  actualWeight: number
  volume: number
  addressCode: number
  address: string
  deliveryDate: string
  slipNumber: number
  shippingNumber: number
  shippingCategory: string
  // --- システムが付与 ---
  lat: number | null
  lng: number | null
  driverName: string | null
  colorCode: string | null
  isUndelivered: boolean      // 未配フラグ（デフォルトfalse）
  memo: string
  geocodeStatus: 'success' | 'failed' | 'pending'
}

type Driver = {
  name: string
  color: string
  vehicleType: '2t' | 'light'
}

type AreaRule = {
  id: string
  region: string              // 例: "横浜市戸塚区"
  driverName: string
  vehicleType: '2t' | 'light'
}
```

## 画面設計

### 1. アップロード画面

- 画面中央に大きなドロップゾーン（「Excelファイルをここにドラッグ」）
- ファイル選択ボタン併置（ドラッグに不慣れな人向け）
- アップロード後プログレスバー：「Excel解析中… → 住所変換中… → 自動振り分け中…」
- 完了後「地図を開く」ボタンで遷移

### 2. 地図画面（メイン）

```
┌─────────────────────────────────────────────────────┐
│ [ヘッダー] 配送先マッピングシステム  [設定] [PDF出力]│
├──────────────────────────┬──────────────────────────┤
│                          │ ドライバー別フィルター     │
│                          │ [■山口] [■金野] [■西川]  │
│                          │ [■小島] [■全員]           │
│                          │──────────────────────────│
│     地図エリア            │ 選択中の配送先情報        │
│     (Leaflet)            │ 届先名: ○○○             │
│                          │ 個口数: 4                │
│     ピンをクリック        │ 実重量: 42kg             │
│     → 右パネルに詳細     │ 容積: 88L                │
│                          │ 届先住所: ○○○           │
│                          │ 納品日: 3/20             │
│                          │ 伝票番号: ○○○           │
│                          │ 出荷番号: ○○○           │
│                          │ 担当: [山口 ▼] ← 変更可  │
│                          │ 未配: [OFF] ← トグル     │
│                          │ メモ: [________] ← 入力  │
│                          │──────────────────────────│
│                          │ 配送先一覧（リスト）      │
│                          │ クリックで地図が移動      │
├──────────────────────────┴──────────────────────────┤
│ [フッター] 全○件 / 未割当○件 / 未配○件             │
│ [プロット失敗: ○件 → クリックで詳細]                 │
│ [共有リンク生成]                                     │
└─────────────────────────────────────────────────────┘
```

**編集可能フィールド**（仕様書準拠）:
- ピンの色（担当者名）: ドロップダウンで変更
- 未配ボタン: トグルスイッチ（デフォルトOFF）
- メモ欄: テキスト入力

**編集不可フィールド**:
- 届先名、個口数、実重量、容積、届先住所、納品日、伝票番号、出荷番号

**ピン表示ルール**:
- 容積 >= 1,000L: 大きめピン（2tトラック対象）
- 容積 < 1,000L: 小さめピン（軽トラック対象）
- ドライバーごとに色分け

### 3. 地域割り設定画面

- ドライバー一覧（名前・色・車両タイプ）の追加/編集/削除
- エリアルール一覧（地域 → ドライバー対応）の編集
- プロトタイプでは市区町村名ベースのシンプルなテーブル形式

### 4. ドライバー参照ビュー

- 共有リンクで開ける読み取り専用の地図画面
- 自分の担当分のみフィルタ表示
- プロトタイプではsessionIdベースのURLパラメータで実現（認証なし）

## 主要ロジック

### Excel解析
- `xlsx`ライブラリでSheet1のRow2以降を読み取り `Delivery[]`に変換
- 列マッピング: A=工場名, B=運送業者コード, C=運送業者名, D=届先コード, E=届先名, F=個口数, G=数量, H=甲数, I=アソート数量, J=実重量, K=容積, L=住所コード, M=届先住所, N=納品日, O=伝票番号, P=出荷番号, Q=運送区分

### 再アップロード時の未配データマージ
- アップロード時、既存データで `isUndelivered === true` のものを保持
- 新データとマージ（伝票番号で突合、重複は新データ優先）

### ジオコーディング
- 住所を国土地理院APIに送信して緯度経度を取得
- 同一住所（addressCode基準）はキャッシュして重複リクエスト防止
- 変換失敗データは `geocodeStatus: 'failed'` にセットし、画面下部にリスト表示

### 自動振り分け（Gemini Flash）
- 住所リスト + エリアルール + 容積情報をプロンプトに含めてGemini Flashに送信
- JSON形式での応答を強制
- 容積 >= 1,000L → 2tトラック担当ドライバーに限定
- 容積 < 1,000L → 軽トラック担当ドライバーに限定

### PDF出力
- ドライバーごとに改ページ
- ヘッダー: ドライバー名、日付、件数合計、重量合計、容積合計
- テーブル: 届先名、個口数、実重量、容積、届先住所、納品日、伝票番号、出荷番号、未配、メモ

## 仕様書要件チェックリスト

| # | 要件 | 対応 |
|---|------|------|
| 1 | Excelにて配送先リストをアップロード | Excel解析機能 |
| 2 | 未配ボタンONのデータを残して読み込み | 再アップロード時マージ |
| 3 | 容積1,000L以上 → 2tトラック用地域割で色分けプロット | ピンサイズ+色分け+振り分けロジック |
| 4 | 容積1,000L未満 → 軽トラック用地域割でプロット | 同上 |
| 5 | ピンクリックで情報表示（11項目） | PinDetailPanel |
| 6 | ピンの色/担当者名とメモ欄のみ編集可 | 編集可/不可フィールド分離 |
| 7 | ダウンロードでドライバー別PDF出力 | PDF生成機能 |
| 8 | 配達担当者が地図を参照可能 | ドライバー参照ビュー（共有URL） |
| 9 | 配送地域割りを管理者がメンテナンス可能 | 地域割り設定画面 |
| 10 | プロットできなかったデータの処理 | GeocodingErrorList |
| 11 | 【将来】配送済みボタン | プロトタイプ対象外 |
| 12 | 【将来】配達実績データ蓄積 | プロトタイプ対象外 |

## スコープ外（プロトタイプ）

- データベース永続化
- ユーザー認証・認可
- 配送済みボタン・完了時刻記録
- 配達実績の蓄積・分析
- 配送ルート最適化
