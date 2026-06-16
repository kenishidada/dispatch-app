-- 配車アプリ初期スキーマ（マルチテナント）
-- 適用方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行（または supabase db push）。
-- secret key では DDL 不可。本ファイルは postgres ロール（SQL Editor）で実行する想定。
-- テナント＝配送会社。データ分離は tenant_id + RLS（JWTの app_metadata.tenant_id と一致する行のみ）。

-- =========================================================
-- 0) JWT から tenant_id を取り出すヘルパ
--    認証ユーザーの app_metadata.tenant_id を返す。JWTが無い（secret key 経由）場合は null。
-- =========================================================
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

-- =========================================================
-- 1) テナント（配送会社）。1社=1テナント。
--    作成/変更は当面、運営が手動（SQL Editor = postgres ロール）で行う。
-- =========================================================
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 2) 車両マスタ（名前付きコース）: テナント別
--    id はテナント内で一意（例: 'light-1'、または UI 生成の uuid）。
-- =========================================================
create table if not exists public.vehicle_master (
  tenant_id    uuid not null default public.auth_tenant_id() references public.tenants(id) on delete cascade,
  id           text not null,
  name         text not null,
  vehicle_type text not null check (vehicle_type in ('light','2t')),
  color        text not null,
  region       text not null default '',               -- 既定の担当エリア（例: '東京都'）
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- =========================================================
-- 3) 車種別の容量上限: テナント別（各社で編集可）
-- =========================================================
create table if not exists public.vehicle_specs (
  tenant_id    uuid not null default public.auth_tenant_id() references public.tenants(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('light','2t')),
  max_volume   int not null,
  max_weight   int not null,
  max_orders   int not null,
  primary key (tenant_id, vehicle_type)
);

-- =========================================================
-- 4) 共有セッション（ドライバー向け公開マップ/PDFの元データ）: テナント別
--    作成はサーバ（secret key = RLSバイパス）からのみ。tenant_id はサーバが明示設定する。
-- =========================================================
create table if not exists public.share_sessions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  payload    jsonb not null,                          -- { deliveries, courses }
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists share_sessions_expires_at_idx on public.share_sessions (expires_at);
create index if not exists share_sessions_tenant_idx on public.share_sessions (tenant_id);

-- =========================================================
-- RLS
-- =========================================================
alter table public.tenants        enable row level security;
alter table public.vehicle_master enable row level security;
alter table public.vehicle_specs  enable row level security;
alter table public.share_sessions enable row level security;

-- tenants: 自テナントのみ参照可（社名表示用）。作成/変更ポリシーは作らない（運営が手動）。
drop policy if exists tn_select on public.tenants;
create policy tn_select on public.tenants for select to authenticated using (id = public.auth_tenant_id());

-- vehicle_master: 自テナント行のみフル操作。insert/update は tenant_id 一致を強制。
drop policy if exists vm_select on public.vehicle_master;
drop policy if exists vm_insert on public.vehicle_master;
drop policy if exists vm_update on public.vehicle_master;
drop policy if exists vm_delete on public.vehicle_master;
create policy vm_select on public.vehicle_master for select to authenticated using (tenant_id = public.auth_tenant_id());
create policy vm_insert on public.vehicle_master for insert to authenticated with check (tenant_id = public.auth_tenant_id());
create policy vm_update on public.vehicle_master for update to authenticated using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id());
create policy vm_delete on public.vehicle_master for delete to authenticated using (tenant_id = public.auth_tenant_id());

-- vehicle_specs: 自テナント行のみフル操作。
drop policy if exists vs_select on public.vehicle_specs;
drop policy if exists vs_insert on public.vehicle_specs;
drop policy if exists vs_update on public.vehicle_specs;
drop policy if exists vs_delete on public.vehicle_specs;
create policy vs_select on public.vehicle_specs for select to authenticated using (tenant_id = public.auth_tenant_id());
create policy vs_insert on public.vehicle_specs for insert to authenticated with check (tenant_id = public.auth_tenant_id());
create policy vs_update on public.vehicle_specs for update to authenticated using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id());
create policy vs_delete on public.vehicle_specs for delete to authenticated using (tenant_id = public.auth_tenant_id());

-- 共有セッション: 公開read（ドライバーはログイン不要・有効期限内のみ）。
-- 書き込みはサーバ（secret key）からのみ行うため、anon/authenticatedの書込ポリシーは作らない。
drop policy if exists ss_public_read on public.share_sessions;
create policy ss_public_read on public.share_sessions for select to anon, authenticated using (expires_at > now());

-- =========================================================
-- Grants（Data API 経由のアクセス。RLSが行レベルを制御）
-- =========================================================
grant select on public.tenants to authenticated;
grant select on public.share_sessions to anon, authenticated;
grant select, insert, update, delete on public.vehicle_master to authenticated;
grant select, insert, update, delete on public.vehicle_specs to authenticated;

-- =========================================================
-- 初期データ: テスト配送会社（固定UUID）＋ そのテナントの車両マスタ/容量
--   ※ 固定UUIDは scripts/bootstrap.mjs の TENANT_ID と一致させること。
--   ※ seed は SQL Editor（postgres）で実行するため auth_tenant_id() は null。tenant_id を明示する。
-- =========================================================
insert into public.tenants (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'テスト配送会社')
on conflict (id) do nothing;

insert into public.vehicle_specs (tenant_id, vehicle_type, max_volume, max_weight, max_orders) values
  ('00000000-0000-4000-8000-000000000001', 'light', 3000, 1050, 35),
  ('00000000-0000-4000-8000-000000000001', '2t',   10000, 3000, 80)
on conflict (tenant_id, vehicle_type) do nothing;

insert into public.vehicle_master (tenant_id, id, name, vehicle_type, color, region, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'light-1', 'K1', 'light', '#34A853', '', 1),
  ('00000000-0000-4000-8000-000000000001', 'light-2', 'K2', 'light', '#4285F4', '', 2),
  ('00000000-0000-4000-8000-000000000001', 'light-3', 'K3', 'light', '#F9AB00', '', 3),
  ('00000000-0000-4000-8000-000000000001', 'light-4', 'K4', 'light', '#FF6D01', '', 4),
  ('00000000-0000-4000-8000-000000000001', 'light-5', 'K5', 'light', '#00ACC1', '', 5),
  ('00000000-0000-4000-8000-000000000001', 'light-6', 'K6', 'light', '#AB47BC', '', 6),
  ('00000000-0000-4000-8000-000000000001', 'truck-1', '2t1', '2t', '#EA4335', '', 7),
  ('00000000-0000-4000-8000-000000000001', 'truck-2', '2t2', '2t', '#A142F4', '', 8)
on conflict (tenant_id, id) do nothing;
