-- 0002_dispatch_data.sql
-- depends on: 0001_init.sql
-- 配車セッション・配送データ・エリア設定のDB化 + share_sessions正規化 + Storageバケット

-- ============================================================
-- 1. dispatch_sessions（1アップロード = 1セッション）
-- ============================================================
create table dispatch_sessions (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null default auth_tenant_id()
                                references tenants(id) on delete cascade,
  delivery_date     date        not null,
  file_name         text        not null default '',
  active_course_ids text[]      not null default '{}',
  status            text        not null default 'draft'
                    check (status in ('draft', 'assigned', 'shared')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_ds_tenant_date on dispatch_sessions(tenant_id, delivery_date);

-- ============================================================
-- 2. deliveries（住所単位に集約済み。集計値はユーザー編集可のため非正規化）
-- ============================================================
create table deliveries (
  id                uuid           primary key default gen_random_uuid(),
  tenant_id         uuid           not null default auth_tenant_id()
                                   references tenants(id) on delete cascade,
  session_id        uuid           not null
                                   references dispatch_sessions(id) on delete cascade,
  factory_name      text           not null default '',
  carrier_code      int            not null default 0,
  carrier_name      text           not null default '',
  destination_code  int            not null default 0,
  destination_name  text           not null default '',
  -- 集計値（slip_details の SUM が初期値だが、ユーザーが手動編集できる）
  package_count     int            not null default 0,
  quantity          int            not null default 0,
  case_count        int            not null default 0,
  assort_quantity   int            not null default 0,
  actual_weight     numeric(10,2)  not null default 0,
  volume            numeric(10,2)  not null default 0,
  address_code      int            not null default 0,
  address           text           not null default '',
  raw_address       text           not null default '',
  delivery_date     date           not null,
  slip_number       bigint         not null default 0,
  shipping_number   bigint         not null default 0,
  shipping_category text           not null default '',
  lat               numeric(9,6),
  lng               numeric(9,6),
  course_id         text,
  color_code        text,
  is_undelivered    boolean        not null default false,
  memo              text           not null default '',
  assign_reason     text           not null default '',
  unassigned_reason text           not null default '',
  geocode_status    text           not null default 'pending'
                    check (geocode_status in ('success', 'failed', 'pending')),
  created_at        timestamptz    not null default now()
);

create index idx_del_session  on deliveries(session_id);
create index idx_del_tenant   on deliveries(tenant_id, delivery_date);
create index idx_del_course   on deliveries(session_id, course_id);
create index idx_del_geocode  on deliveries(session_id, geocode_status)
  where geocode_status != 'success';

-- ============================================================
-- 3. slip_details（元データの監査証跡。1 delivery : N slips）
-- ============================================================
create table slip_details (
  id              uuid           primary key default gen_random_uuid(),
  tenant_id       uuid           not null default auth_tenant_id()
                                 references tenants(id) on delete cascade,
  delivery_id     uuid           not null
                                 references deliveries(id) on delete cascade,
  slip_number     bigint         not null,
  shipping_number bigint         not null,
  package_count   int            not null default 0,
  quantity        int            not null default 0,
  case_count      int            not null default 0,
  assort_quantity int            not null default 0,
  actual_weight   numeric(10,2)  not null default 0,
  volume          numeric(10,2)  not null default 0,
  factory_name    text           not null default ''
);

create index idx_slip_delivery on slip_details(delivery_id);

-- ============================================================
-- 4. area_rules（エリアルール設定）
-- ============================================================
create table area_rules (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null default auth_tenant_id()
                         references tenants(id) on delete cascade,
  region     text        not null,
  course_id  text        not null,
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ar_tenant on area_rules(tenant_id);

-- ============================================================
-- 5. area_images（Supabase Storage参照。画像本体はバケットに保存）
-- ============================================================
create table area_images (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null default auth_tenant_id()
                           references tenants(id) on delete cascade,
  storage_path text        not null,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now()
);

create index idx_ai_tenant on area_images(tenant_id);

-- ============================================================
-- 6. share_sessions: 追加カラム（既存payload列は残してフォールバック可）
-- ============================================================
alter table share_sessions
  add column if not exists session_id uuid references dispatch_sessions(id),
  add column if not exists course_id  text;

create index idx_ss_session on share_sessions(session_id)
  where session_id is not null;

-- ============================================================
-- 7. Supabase Storage バケット
--    area-images: テナントごとフォルダ {tenant_id}/{uuid}.{ext}
--    将来の delivery-photos も同パターンで追加可能
-- ============================================================
insert into storage.buckets (id, name, public)
values ('area-images', 'area-images', false)
on conflict (id) do nothing;

-- ============================================================
-- 8. RLS ポリシー
-- ============================================================

-- dispatch_sessions
alter table dispatch_sessions enable row level security;

create policy ds_tenant on dispatch_sessions
  for all to authenticated
  using  (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create policy ds_shared_read on dispatch_sessions
  for select to anon, authenticated
  using (
    exists (
      select 1 from share_sessions ss
      where ss.session_id = dispatch_sessions.id
        and ss.expires_at > now()
    )
  );

-- deliveries
alter table deliveries enable row level security;

create policy del_tenant on deliveries
  for all to authenticated
  using  (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create policy del_shared_read on deliveries
  for select to anon, authenticated
  using (
    exists (
      select 1 from share_sessions ss
      where ss.session_id = deliveries.session_id
        and ss.expires_at > now()
        and (ss.course_id is null or ss.course_id = deliveries.course_id)
    )
  );

-- slip_details
alter table slip_details enable row level security;

create policy sd_tenant on slip_details
  for all to authenticated
  using  (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create policy sd_shared_read on slip_details
  for select to anon, authenticated
  using (
    exists (
      select 1 from deliveries d
      join share_sessions ss on ss.session_id = d.session_id
      where d.id = slip_details.delivery_id
        and ss.expires_at > now()
        and (ss.course_id is null or ss.course_id = d.course_id)
    )
  );

-- area_rules
alter table area_rules enable row level security;

create policy ar_tenant on area_rules
  for all to authenticated
  using  (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- area_images
alter table area_images enable row level security;

create policy aim_tenant on area_images
  for all to authenticated
  using  (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- Storage RLS: area-images バケット
create policy storage_ai_select on storage.objects
  for select to authenticated
  using (bucket_id = 'area-images' and (storage.foldername(name))[1] = auth_tenant_id()::text);

create policy storage_ai_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'area-images' and (storage.foldername(name))[1] = auth_tenant_id()::text);

create policy storage_ai_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'area-images' and (storage.foldername(name))[1] = auth_tenant_id()::text);

-- ============================================================
-- 9. Grants
-- ============================================================
grant select, insert, update, delete on dispatch_sessions to authenticated;
grant select, insert, update, delete on deliveries to authenticated;
grant select, insert, update, delete on slip_details to authenticated;
grant select, insert, update, delete on area_rules to authenticated;
grant select, insert, update, delete on area_images to authenticated;

grant select on dispatch_sessions to anon;
grant select on deliveries to anon;
grant select on slip_details to anon;
