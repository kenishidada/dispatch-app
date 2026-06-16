import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const BUCKET = "area-images";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("area_images")
    .select("id, storage_path, sort_order")
    .eq("tenant_id", TENANT_ID)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const images = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 3600);
      return {
        id: row.id,
        url: signed?.signedUrl ?? null,
        sortOrder: row.sort_order,
      };
    })
  );
  return NextResponse.json(images);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "png";
  const storagePath = `${TENANT_ID}/${uuidv4()}.${ext}`;

  const supabase = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: maxOrder } = await supabase
    .from("area_images")
    .select("sort_order")
    .eq("tenant_id", TENANT_ID)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

  const { data: row, error: insertError } = await supabase
    .from("area_images")
    .insert({ tenant_id: TENANT_ID, storage_path: storagePath, sort_order: nextOrder })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({ id: row.id, url: signed?.signedUrl ?? null, sortOrder: nextOrder });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("area_images")
    .select("storage_path")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .single();

  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }

  const { error } = await supabase
    .from("area_images")
    .delete()
    .eq("id", id)
    .eq("tenant_id", TENANT_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
