import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Course, VehicleSpec } from "@/shared/types/delivery";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TENANT_ID,
  dbDeliveryToClient,
  dbSlipToClient,
  type DbDeliveryRow,
  type DbSlipRow,
} from "@/lib/supabase/mappers";

const BUCKET = "area-images";

async function fetchAreaImagesAsBase64(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("area_images")
    .select("storage_path")
    .eq("tenant_id", TENANT_ID)
    .order("sort_order");

  if (!rows || rows.length === 0) return [];

  const results: string[] = [];
  for (const row of rows) {
    const { data } = await supabase.storage.from(BUCKET).download(row.storage_path);
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      const mimeType = (row.storage_path as string).endsWith(".png") ? "image/png" : "image/jpeg";
      results.push(`data:${mimeType};base64,${buffer.toString("base64")}`);
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, courses, areaDescription } = body as {
    sessionId: string;
    courses: Course[];
    areaDescription?: string;
  };

  if (!sessionId || !courses) {
    return NextResponse.json({ error: "sessionId and courses are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("dispatch_sessions")
    .select("active_course_ids")
    .eq("id", sessionId)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const activeCourseIds: string[] = session.active_course_ids ?? courses.map((c: Course) => c.id);

  const { data: dbDeliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("session_id", sessionId)
    .eq("tenant_id", TENANT_ID);

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

  const { data: vehicleSpecRows } = await supabase
    .from("vehicle_specs")
    .select("vehicle_type, max_volume, max_weight, max_orders")
    .eq("tenant_id", TENANT_ID);

  const vehicleSpecs: VehicleSpec[] = (vehicleSpecRows ?? []).map((r) => ({
    vehicleType: r.vehicle_type as "light" | "2t",
    maxVolume: r.max_volume,
    maxWeight: r.max_weight,
    maxOrders: r.max_orders,
  }));

  const { data: areaRuleRows } = await supabase
    .from("area_rules")
    .select("id, region, course_id")
    .eq("tenant_id", TENANT_ID)
    .order("sort_order");

  const areaRules = (areaRuleRows ?? []).map((r) => ({
    id: r.id,
    region: r.region,
    courseId: r.course_id,
  }));

  const areaImages = await fetchAreaImagesAsBase64();

  // autoAssignには未割当状態で渡す（再実行時に前回結果が影響しない）
  const cleanDeliveries = deliveries.map((d) => ({
    ...d, courseId: null, colorCode: null, assignReason: "", unassignedReason: "",
  }));

  const output = await autoAssign(
    cleanDeliveries, courses, activeCourseIds, vehicleSpecs,
    areaRules, areaImages, areaDescription || "", null
  );

  // 先に全件クリアしてから新しい割当を書き込む
  await supabase
    .from("deliveries")
    .update({ course_id: null, color_code: null, assign_reason: "", unassigned_reason: "" })
    .eq("session_id", sessionId)
    .eq("tenant_id", TENANT_ID);

  for (const a of output.assignments) {
    const course = a.courseId ? courses.find((c: Course) => c.id === a.courseId) : null;
    await supabase
      .from("deliveries")
      .update({
        course_id: a.courseId ?? null,
        color_code: course?.color ?? null,
        assign_reason: a.reason || "",
        unassigned_reason: a.unassignedReason || "",
      })
      .eq("id", a.deliveryId)
      .eq("session_id", sessionId);
  }

  await supabase
    .from("dispatch_sessions")
    .update({ status: "assigned" })
    .eq("id", sessionId);

  console.log("[assign] session:", sessionId);
  console.log("[assign] active courses:", activeCourseIds);
  console.log("[assign] assigned:", output.assignments.filter((a) => a.courseId).length, "/", output.assignments.length);

  return NextResponse.json(output);
}
