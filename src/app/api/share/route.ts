import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dbDeliveryToClient,
  dbSlipToClient,
  type DbDeliveryRow,
  type DbSlipRow,
} from "@/lib/supabase/mappers";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createAdminClient();

  if (body.sessionId) {
    const { sessionId, courseId, courses } = body as {
      sessionId: string;
      courseId?: string | null;
      courses?: unknown;
    };

    const { data, error } = await supabase
      .from("share_sessions")
      .insert({
        tenant_id: TENANT_ID,
        session_id: sessionId,
        course_id: courseId ?? null,
        payload: courses ? { courses } : {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data.id });
  }

  // Legacy: payload方式（後方互換）
  const { data, error } = await supabase
    .from("share_sessions")
    .insert({
      tenant_id: TENANT_ID,
      payload: body,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: data.id });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: share, error } = await supabase
    .from("share_sessions")
    .select("*")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // session_id参照方式
  if (share.session_id) {
    let query = supabase
      .from("deliveries")
      .select("*")
      .eq("session_id", share.session_id);

    if (share.course_id) {
      query = query.eq("course_id", share.course_id);
    }

    const { data: dbDeliveries } = await query;
    const deliveryRows = (dbDeliveries ?? []) as DbDeliveryRow[];

    const deliveryIds = deliveryRows.map((d) => d.id);
    const slipsByDelivery = new Map<string, DbSlipRow[]>();

    if (deliveryIds.length > 0) {
      const { data: slips } = await supabase
        .from("slip_details")
        .select("*")
        .in("delivery_id", deliveryIds);

      for (const slip of (slips ?? []) as DbSlipRow[]) {
        const arr = slipsByDelivery.get(slip.delivery_id) ?? [];
        arr.push(slip);
        slipsByDelivery.set(slip.delivery_id, arr);
      }
    }

    const deliveries = deliveryRows.map((row) => {
      const slips = (slipsByDelivery.get(row.id) ?? []).map(dbSlipToClient);
      return dbDeliveryToClient(row, slips);
    });

    const courses = (share.payload as Record<string, unknown>)?.courses ?? [];

    return NextResponse.json({ deliveries, courses });
  }

  // Legacy: payload方式フォールバック
  return NextResponse.json(share.payload);
}
