import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const shareStore = new Map<string, { data: unknown; createdAt: number }>();

function cleanup() {
  const now = Date.now();
  for (const [key, value] of shareStore) {
    if (now - value.createdAt > 3600000) shareStore.delete(key);
  }
}

export async function POST(request: NextRequest) {
  cleanup();
  const body = await request.json();
  const bodyText = JSON.stringify(body);
  if (bodyText.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Data too large" }, { status: 413 });
  }
  if (shareStore.size >= 100) {
    cleanup();
    if (shareStore.size >= 100) {
      return NextResponse.json({ error: "Too many active sessions" }, { status: 429 });
    }
  }
  const sessionId = uuidv4();
  shareStore.set(sessionId, { data: body, createdAt: Date.now() });
  return NextResponse.json({ sessionId });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !shareStore.has(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(shareStore.get(id)!.data);
}
