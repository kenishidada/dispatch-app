import { NextRequest, NextResponse } from "next/server";
import { geocodeBatch } from "@/lib/geocoding";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const addresses: { id: string; address: string }[] = body.addresses;

  if (!addresses || !Array.isArray(addresses)) {
    return NextResponse.json({ error: "addresses is required" }, { status: 400 });
  }

  const results = await geocodeBatch(addresses);
  const response = Object.fromEntries(results);

  return NextResponse.json({ results: response });
}
