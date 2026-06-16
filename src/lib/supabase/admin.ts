import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * サーバー専用の管理クライアント。secret key を使用し RLS をバイパスする。
 * 絶対にクライアント／ブラウザへ渡さないこと（NEXT_PUBLIC_ にしない）。
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
