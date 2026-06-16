import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vehicle_specs")
    .select("vehicle_type, max_volume, max_weight, max_orders")
    .eq("tenant_id", TENANT_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const specs = (data ?? []).map((r) => ({
    vehicleType: r.vehicle_type as "light" | "2t",
    maxVolume: r.max_volume,
    maxWeight: r.max_weight,
    maxOrders: r.max_orders,
  }));
  return NextResponse.json(specs);
}

export async function POST(request: Request) {
  const specs: Array<{ vehicleType: string; maxVolume: number; maxWeight: number; maxOrders: number }> =
    await request.json();

  const supabase = createAdminClient();
  const rows = specs.map((s) => ({
    tenant_id: TENANT_ID,
    vehicle_type: s.vehicleType,
    max_volume: s.maxVolume,
    max_weight: s.maxWeight,
    max_orders: s.maxOrders,
  }));

  const { error } = await supabase
    .from("vehicle_specs")
    .upsert(rows, { onConflict: "tenant_id,vehicle_type" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
