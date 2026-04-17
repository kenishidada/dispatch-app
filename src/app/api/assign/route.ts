import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Course, AreaRule, VehicleSpec } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    deliveries, courses, activeCourseIds, vehicleSpecs, areaRules, areaImage, areaDescription,
  } = body as {
    deliveries: Delivery[];
    courses: Course[];
    activeCourseIds: string[];
    vehicleSpecs: VehicleSpec[];
    areaRules: AreaRule[];
    areaImage: string | null;
    areaDescription: string;
  };

  if (!deliveries || !courses || !activeCourseIds || !vehicleSpecs) {
    return NextResponse.json(
      { error: "deliveries, courses, activeCourseIds, vehicleSpecs are required" },
      { status: 400 }
    );
  }

  const output = await autoAssign(
    deliveries, courses, activeCourseIds, vehicleSpecs,
    areaRules || [], areaImage || null, areaDescription || ""
  );
  console.log("[assign] active courses:", activeCourseIds);
  console.log("[assign] assigned:", output.assignments.filter((a) => a.courseId).length, "/", output.assignments.length);
  console.log("[assign] warnings:", output.capacityWarnings.length);
  return NextResponse.json(output);
}
