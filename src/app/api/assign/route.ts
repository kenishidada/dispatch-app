import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Course, AreaRule, VehicleSpec } from "@/shared/types/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
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
      const mimeType = row.storage_path.endsWith(".png") ? "image/png" : "image/jpeg";
      results.push(`data:${mimeType};base64,${buffer.toString("base64")}`);
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaDescription, prefetchedImageRules,
  } = body as {
    deliveries: Delivery[];
    courses: Course[];
    activeCourseIds: string[];
    vehicleSpecs: VehicleSpec[];
    areaRules: AreaRule[];
    areaDescription: string;
    prefetchedImageRules: string | null;
  };

  if (!deliveries || !courses || !activeCourseIds || !vehicleSpecs) {
    return NextResponse.json(
      { error: "deliveries, courses, activeCourseIds, vehicleSpecs are required" },
      { status: 400 }
    );
  }

  const areaImages = await fetchAreaImagesAsBase64();

  const output = await autoAssign(
    deliveries, courses, activeCourseIds, vehicleSpecs,
    areaRules || [], areaImages, areaDescription || "", prefetchedImageRules || null
  );
  console.log("[assign] active courses:", activeCourseIds);
  console.log("[assign] assigned:", output.assignments.filter((a) => a.courseId).length, "/", output.assignments.length);
  console.log("[assign] warnings:", output.capacityWarnings.length);
  return NextResponse.json(output);
}
