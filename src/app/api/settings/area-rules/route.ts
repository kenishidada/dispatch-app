import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("area_rules")
    .select("id, region, course_id, sort_order")
    .eq("tenant_id", TENANT_ID)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rules = (data ?? []).map((r) => ({
    id: r.id,
    region: r.region,
    courseId: r.course_id,
  }));
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const rules: Array<{ id?: string; region: string; courseId: string }> = await request.json();
  const supabase = createAdminClient();

  // 全削除 → 再挿入（ルール数が少ないため単純な置き換え）
  await supabase.from("area_rules").delete().eq("tenant_id", TENANT_ID);

  if (rules.length > 0) {
    const rows = rules.map((r, i) => ({
      tenant_id: TENANT_ID,
      region: r.region,
      course_id: r.courseId,
      sort_order: i,
    }));
    const { error } = await supabase.from("area_rules").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
