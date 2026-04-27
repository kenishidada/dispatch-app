import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Course, AreaRule, VehicleSpec } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImages, areaDescription, prefetchedImageRules,
  } = body as {
    deliveries: Delivery[];
    courses: Course[];
    activeCourseIds: string[];
    vehicleSpecs: VehicleSpec[];
    areaRules: AreaRule[];
    areaImages: string[];
    areaDescription: string;
    prefetchedImageRules: string | null;
  };

  if (!deliveries || !courses || !activeCourseIds || !vehicleSpecs) {
    return NextResponse.json(
      { error: "deliveries, courses, activeCourseIds, vehicleSpecs are required" },
      { status: 400 }
    );
  }

  const output = await autoAssign(
    deliveries, courses, activeCourseIds, vehicleSpecs,
    areaRules || [], areaImages || [], areaDescription || "", prefetchedImageRules || null
  );
  console.log("[assign] active courses:", activeCourseIds);
  console.log("[assign] assigned:", output.assignments.filter((a) => a.courseId).length, "/", output.assignments.length);
  console.log("[assign] warnings:", output.capacityWarnings.length);
  return NextResponse.json(output);
}
