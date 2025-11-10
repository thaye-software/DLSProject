import { db } from "@/database/drizzle";
import { brands } from "@/database/schema";
import { eq } from "drizzle-orm";

export const brandService = {
  async getBrandById(id: number) {
    try {
      const brand = await db.query.brands.findFirst({
        where: eq(brands.id, id),
      });

      if (!brand) {
        return { success: false, error: "Brand not found" };
      }

      return { success: true, data: brand };
    } catch (error) {
      console.error("Error fetching brand by ID:", error);
      return { success: false, error: "Failed to fetch brand" };
    }
  },
  
  async getAllBrands() {
    try {
      const allBrands = await db.query.brands.findMany();

      return { data: allBrands };
    } catch (error) {
      console.error("Error fetching brands:", error);
      return { error: "Failed to fetch brands" };
    }
  },

  async createBrand(
    data: {
      name: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      stateProvince?: string;
      phoneNumber?: string;
      email?: string;
      website?: string;
    }
  ) {
    const slug = data.name.toLowerCase().replace(/\s+/g, "-");

    try {
      console.log("Creating brand with data:", data);
      const result = await db
        .insert(brands)
        .values({ ...data, slug })
        .returning();
      return { data: result[0] };
    } catch (error) {
      console.error("Error creating brand:", error);
      return { error: "Failed to create brand" };
    }
  },

  async editBrand(
    id: number,
    data: {
      name?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      stateProvince?: string;
      phoneNumber?: string;
      email?: string;
      website?: string;
    }
  ) {
    try {
      console.log("Updating brand with ID:", id);
      console.log("Updated brand data:", data);
      const result = await db
        .update(brands)
        .set(data)
        .where(eq(brands.id, id))
        .returning();
      return { data: result[0] };
    } catch (error) {
      console.error("Error editing brand:", error);
      return { error: "Failed to edit brand" };
    }
  },
};
