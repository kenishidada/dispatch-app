import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_specs")
    .select("vehicle_type, max_volume, max_weight, max_orders");

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

  const supabase = await createClient();
  const rows = specs.map((s) => ({
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
