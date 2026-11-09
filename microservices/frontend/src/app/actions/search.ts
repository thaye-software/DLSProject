"use server";

import { searchProducts, type ProductListing } from "@/services/searchService";

export async function searchAction(q: string): Promise<ProductListing[]> {
  try {
    return (await searchProducts({ q, pageSize: 6 })).items;
  } catch {
    return [];
  }
}
