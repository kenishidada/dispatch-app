import { NextRequest, NextResponse } from "next/server";
import { autoAssign } from "@/lib/gemini";
import { Delivery, Driver, AreaRule } from "@/shared/types/delivery";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deliveries, drivers, areaRules } = body as {
    deliveries: Delivery[];
    drivers: Driver[];
    areaRules: AreaRule[];
  };

  if (!deliveries || !drivers) {
    return NextResponse.json({ error: "deliveries and drivers are required" }, { status: 400 });
  }

  const assignments = await autoAssign(deliveries, drivers, areaRules || []);
  return NextResponse.json({ assignments });
}
