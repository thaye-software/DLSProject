import { db } from "@/database/drizzle";

export const brandService = {
  async getAllBrands() {
    try {
      const allBrands = await db.query.brands.findMany({
        with: { productSafetyInfo: true },
      });
      
      return { success: true, data: allBrands };
    } catch (error) {
      console.error("Error fetching brands:", error);
      return { success: false, error: "Failed to fetch brands" };
    }
  },
} as const;
