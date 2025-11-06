import { createClient } from "@/database/supabase/client";

const supabase = createClient();

/**
 * Uploads a file to Supabase storage and returns the public URL.
 * @param file File to be uploaded
 * @returns publicUrl as string
 */
type UploadResult = { path: string; publicUrl: string | null } | null;

async function uploadFile(file: File, path?: string): Promise<UploadResult> {
  const uploadPath = path ?? "" + crypto.randomUUID() + "_" + file.name;
  const { data, error } = await supabase.storage
    .from("product_images")
    .upload(uploadPath, file);

  if (error) {
    console.error("Error uploading file:", error);
    return null;
  }

  const publicUrl = supabase.storage
    .from("product_images")
    .getPublicUrl(data.path).data.publicUrl;
  return { path: data.path, publicUrl };
}

export const supabaseService = {
  uploadFile,
};
