"use server";
import { BrandModel } from "@/database/types";
import { createBrand, editBrand, getAllBrands } from "@/services/brandService";
import { revalidatePath } from "next/cache";

export async function getBrands() {
  return await getAllBrands();
}

export async function createNewBrand(formData: FormData): Promise<BrandModel> {
  const newBrand = Object.fromEntries(formData);
  try {
    const res = await createBrand(newBrand as any);
    revalidatePath("/admin/masterdata/brands");
    return res;
  } catch (err) {
    console.error("Error creating brand:", err);
    throw err;
  }
}

export async function updateBrand(formData: FormData): Promise<BrandModel> {
  const updatedBrand = Object.fromEntries(formData);
  const brandId = updatedBrand.id as string;
  try {
    const res = await editBrand(brandId, updatedBrand as any);
    revalidatePath("/admin/masterdata/brands");
    return res;
  } catch (err) {
    console.error("Error updating brand:", err);
    throw err;
  }
}
