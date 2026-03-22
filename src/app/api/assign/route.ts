import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Driver, AreaRule } from "@/shared/types/delivery";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deliveries, drivers, areaRules, areaImage, areaDescription } = body as {
    deliveries: Delivery[];
    drivers: Driver[];
    areaRules: AreaRule[];
    areaImage: string | null;
    areaDescription: string;
  };

  if (!deliveries || !drivers) {
    return NextResponse.json({ error: "deliveries and drivers are required" }, { status: 400 });
  }

  const assignments = await autoAssign(deliveries, drivers, areaRules || [], areaImage || null, areaDescription || "");
  console.log("[assign] drivers received:", drivers.map(d => d.name));
  console.log("[assign] sample assignments:", assignments.slice(0, 3));
  console.log("[assign] assigned count:", assignments.filter(a => a.driverName).length, "/", assignments.length);
  return NextResponse.json({ assignments });
}
