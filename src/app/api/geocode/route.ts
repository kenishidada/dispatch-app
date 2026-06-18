import { NextRequest, NextResponse } from "next/server";
import { geocodeBatch } from "@/lib/geocoding";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId } = body as { sessionId: string };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("deliveries")
    .select("id, address")
    .eq("session_id", sessionId)
    .eq("geocode_status", "pending")
    .neq("address", "");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ updates: [] });
  }

  const addresses = pending.map((d) => ({ id: d.id, address: d.address as string }));
  const resultMap = await geocodeBatch(addresses);

  const updates: { id: string; lat: number | null; lng: number | null; geocodeStatus: "success" | "failed" }[] = [];

  for (const row of pending) {
    const result = resultMap.get(row.address as string);
    if (result) {
      await supabase
        .from("deliveries")
        .update({ lat: result.lat, lng: result.lng, geocode_status: "success" })
        .eq("id", row.id);
      updates.push({ id: row.id, lat: result.lat, lng: result.lng, geocodeStatus: "success" });
    } else {
      await supabase
        .from("deliveries")
        .update({ geocode_status: "failed" })
        .eq("id", row.id);
      updates.push({ id: row.id, lat: null, lng: null, geocodeStatus: "failed" });
    }
  }

  return NextResponse.json({ updates });
}
