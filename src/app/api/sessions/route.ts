import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TENANT_ID,
  clientDeliveryToDbInsert,
  clientSlipToDbInsert,
  dbDeliveryToClient,
  dbSlipToClient,
  type DbDeliveryRow,
  type DbSlipRow,
} from "@/lib/supabase/mappers";
import type { Delivery } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deliveries, fileName } = body as {
    deliveries: Delivery[];
    fileName: string;
  };

  if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
    return NextResponse.json({ error: "deliveries is required" }, { status: 400 });
  }

  const deliveryDate = deliveries[0].deliveryDate || new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();

  const { data: session, error: sessionErr } = await supabase
    .from("dispatch_sessions")
    .insert({
      tenant_id: TENANT_ID,
      delivery_date: deliveryDate,
      file_name: fileName || "",
      status: "draft",
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: sessionErr?.message ?? "session insert failed" }, { status: 500 });
  }

  const sessionId = session.id;

  const dbRows = deliveries.map((d) => clientDeliveryToDbInsert(d, sessionId, TENANT_ID));
  const { data: insertedDeliveries, error: delErr } = await supabase
    .from("deliveries")
    .insert(dbRows)
    .select("*");

  if (delErr || !insertedDeliveries) {
    return NextResponse.json({ error: delErr?.message ?? "deliveries insert failed" }, { status: 500 });
  }

  const slipRows: ReturnType<typeof clientSlipToDbInsert>[] = [];
  for (let i = 0; i < deliveries.length; i++) {
    const dbDelivery = insertedDeliveries[i] as DbDeliveryRow;
    const clientDelivery = deliveries[i];
    if (clientDelivery.slips) {
      for (const slip of clientDelivery.slips) {
        slipRows.push(clientSlipToDbInsert(slip, dbDelivery.id, TENANT_ID));
      }
    }
  }

  let insertedSlips: DbSlipRow[] = [];
  if (slipRows.length > 0) {
    const { data: slips, error: slipErr } = await supabase
      .from("slip_details")
      .insert(slipRows)
      .select("*");
    if (slipErr) {
      console.error("[sessions] slip_details insert error:", slipErr.message);
    }
    insertedSlips = (slips as DbSlipRow[] | null) ?? [];
  }

  const slipsByDelivery = new Map<string, DbSlipRow[]>();
  for (const slip of insertedSlips) {
    const arr = slipsByDelivery.get(slip.delivery_id) ?? [];
    arr.push(slip);
    slipsByDelivery.set(slip.delivery_id, arr);
  }

  const resultDeliveries = (insertedDeliveries as DbDeliveryRow[]).map((row) => {
    const slips = (slipsByDelivery.get(row.id) ?? []).map(dbSlipToClient);
    return dbDeliveryToClient(row, slips);
  });

  return NextResponse.json({ sessionId, deliveries: resultDeliveries });
}

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dispatch_sessions")
    .select("id, delivery_date, file_name, status, active_course_ids, created_at, deliveries(count)")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessions = (data ?? []).map((s) => ({
    id: s.id,
    deliveryDate: s.delivery_date,
    fileName: s.file_name,
    status: s.status,
    activeCourseIds: s.active_course_ids,
    deliveryCount: (s.deliveries as unknown as { count: number }[])?.[0]?.count ?? 0,
    createdAt: s.created_at,
  }));

  return NextResponse.json({ sessions });
}
