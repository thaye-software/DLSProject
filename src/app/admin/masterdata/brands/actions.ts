"use server";
import { brandService } from "@/services/brandService";
import { revalidatePath } from "next/cache";

export async function getBrands() {
  return await brandService.getAllBrands();
}

export async function createBrand(formData: FormData): Promise<any> {
  const newBrand = Object.fromEntries(formData);
  try {
    const res = await brandService.createBrand(newBrand as any);
    revalidatePath("/admin/masterdata/brands");
    return res;
  } catch (err) {
    console.error("Error creating brand:", err);
    throw err;
  }
}

export async function updateBrand(formData: FormData): Promise<any> {
  const updatedBrand = Object.fromEntries(formData);
  const brandId = updatedBrand.id as string;
  try {
    const res = await brandService.editBrand(brandId, updatedBrand as any);
    revalidatePath("/admin/masterdata/brands");
    return res;
  } catch (err) {
    console.error("Error updating brand:", err);
    throw err;
  }
}
