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
