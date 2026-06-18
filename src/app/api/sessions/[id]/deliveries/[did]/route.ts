import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID, clientPartialToDb } from "@/lib/supabase/mappers";
import type { Delivery } from "@/shared/types/delivery";

type RouteParams = { params: Promise<{ id: string; did: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId, did } = await params;
  const changes = (await request.json()) as Partial<Delivery>;

  const dbChanges = clientPartialToDb(changes);
  if (Object.keys(dbChanges).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("deliveries")
    .update(dbChanges)
    .eq("id", did)
    .eq("session_id", sessionId)
    .eq("tenant_id", TENANT_ID)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "delivery not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
