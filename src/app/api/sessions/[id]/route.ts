import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbDeliveryToClient,
  dbSlipToClient,
  type DbDeliveryRow,
  type DbSlipRow,
} from "@/lib/supabase/mappers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("dispatch_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const { data: dbDeliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("session_id", id);

  const deliveryIds = (dbDeliveries ?? []).map((d: DbDeliveryRow) => d.id);
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

  const deliveries = (dbDeliveries as DbDeliveryRow[] ?? []).map((row) => {
    const slips = (slipsByDelivery.get(row.id) ?? []).map(dbSlipToClient);
    return dbDeliveryToClient(row, slips);
  });

  return NextResponse.json({
    session: {
      id: session.id,
      deliveryDate: session.delivery_date,
      fileName: session.file_name,
      status: session.status,
      activeCourseIds: session.active_course_ids,
      createdAt: session.created_at,
    },
    deliveries,
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (body.activeCourseIds !== undefined) updates.active_course_ids = body.activeCourseIds;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("dispatch_sessions")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
