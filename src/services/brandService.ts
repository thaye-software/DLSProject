import { db } from "@/database/drizzle";
import { brands, productSafetyInfo } from "@/database/schema";
import { eq } from "drizzle-orm";

export interface Brand {
  id: number;
  name: string;
  product_safety_info_id: number | null;
}

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
