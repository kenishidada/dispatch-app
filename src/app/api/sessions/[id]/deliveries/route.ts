import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientPartialToDb } from "@/lib/supabase/mappers";
import type { Delivery } from "@/shared/types/delivery";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const body = await request.json();
  const { updates } = body as {
    updates: { id: string; changes: Partial<Delivery> }[];
  };

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates is required" }, { status: 400 });
  }

  const supabase = await createClient();
  let updatedCount = 0;

  for (const { id, changes } of updates) {
    const dbChanges = clientPartialToDb(changes);
    if (Object.keys(dbChanges).length === 0) continue;

    const { error } = await supabase
      .from("deliveries")
      .update(dbChanges)
      .eq("id", id)
      .eq("session_id", sessionId);

    if (!error) updatedCount++;
  }

  return NextResponse.json({ updatedCount });
}
