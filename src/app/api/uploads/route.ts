import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/database/drizzle";
import { productImages } from "@/database/schema";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing SUPABASE config on server" },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const form = await request.formData();
    const productIdRaw = form.get("productId");
    const productId = productIdRaw
      ? Number(productIdRaw.toString())
      : undefined;

    // support multiple file fields named 'files' or a single 'file'
    const files: File[] = [];
    const maybeFiles = form.getAll("files");
    if (maybeFiles && maybeFiles.length) {
      for (const f of maybeFiles) {
        if (f instanceof File) files.push(f);
      }
    }
    const single = form.get("file");
    if (single instanceof File) files.push(single);

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploaded: Array<{
      path: string;
      publicUrl: string | null;
      dbRow?: any;
    }> = [];

    for (const file of files) {
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${
        file.name
      }`;
      const path = `product_images/${unique}`;

      // read file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabase.storage
        .from("product_images")
        .upload(path, buffer, { contentType: file.type });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const publicUrl = supabase.storage
        .from("product_images")
        .getPublicUrl(data.path).data.publicUrl;

      let dbRow = undefined;
      if (productId) {
        const res = await db
          .insert(productImages)
          .values({
            productId,
            imageUrl: publicUrl ?? data.path,
            isThumbnail: false,
          })
          .returning();
        dbRow = res[0];
      }

      uploaded.push({ path: data.path, publicUrl, dbRow });
    }

    return NextResponse.json({ uploaded }, { status: 201 });
  } catch (err: any) {
    console.error("Upload endpoint error:", err);
    return NextResponse.json(
      { error: err.message ?? String(err) },
      { status: 500 }
    );
  }
}
