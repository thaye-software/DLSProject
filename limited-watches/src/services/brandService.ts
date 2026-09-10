"use server";

import { db } from "@/database/drizzle";
import { brands } from "@/database/schema";
import { eq } from "drizzle-orm";
import { BrandModel, NewBrandModel } from "@/database/types";

export async function getBrandById(id: string): Promise<BrandModel> {
  try {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, id),
    });

    if (!brand) {
      console.error(`Brand with ID ${id} not found.`);
      throw new Error(`Brand with ID ${id} not found.`);
    }

    return brand;
  } catch (error) {
    console.error("Error fetching brand by ID:", error);
    throw error;
  }
}

export async function getAllBrands(): Promise<BrandModel[]> {
  try {
    const allBrands = await db.query.brands.findMany();
    return allBrands;
  } catch (error) {
    console.error("(server) Failed to get all brands:", error);
    throw error;
  }
}

export async function createBrand(brandToCreate: NewBrandModel): Promise<BrandModel> {
  const slug = brandToCreate.name.toLowerCase().replace(/\s+/g, "-");

  try {
    const result = await db
      .insert(brands)
      .values({ ...brandToCreate, slug })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error creating brand:", error);
    throw new Error("Failed to create brand");
  }
}

export async function editBrand(
  id: string,
  data: NewBrandModel
): Promise<BrandModel> {
  try {
    const result = await db
      .update(brands)
      .set(data)
      .where(eq(brands.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error editing brand:", error);
    throw new Error("Failed to edit brand");
  }
}
