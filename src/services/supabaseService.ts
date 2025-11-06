import { createClient } from "@/database/supabase/client";

const supabase = createClient();

/**
 * Uploads a file to Supabase storage and returns the public URL.
 * @param file File to be uploaded
 * @returns publicUrl as string
 */
async function uploadFile(file: File): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("product_images").upload('' + crypto.randomUUID() + '_' + file.name, file);

  if (error) {
    console.error("Error uploading file:", error);
    return null;
  }

  const publicUrl = supabase.storage.from("product_images").getPublicUrl(data.path).data.publicUrl;
  return publicUrl;
}

export const supabaseService = {
  uploadFile,
};