import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("area_rules")
    .select("id, region, course_id, sort_order")
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
  const supabase = await createClient();

  await supabase.from("area_rules").delete().gte("sort_order", 0);

  if (rules.length > 0) {
    const rows = rules.map((r, i) => ({
      region: r.region,
      course_id: r.courseId,
      sort_order: i,
    }));
    const { error } = await supabase.from("area_rules").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
