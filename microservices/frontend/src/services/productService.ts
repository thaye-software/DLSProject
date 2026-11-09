import "server-only";
import { GatewayError, gatewayFetch } from "@/lib/gateway";
import type { Money } from "@/lib/money";
import type { Availability } from "./searchService";

// Typed from docs/contracts/openapi.yaml (ProductSummary)
export type ProductSummary = {
  product_id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  model: string | null;
  price: Money;
  availability: Availability;
  thumbnail_url: string | null;
};

export async function getProduct(id: string): Promise<ProductSummary | null> {
  try {
    return await gatewayFetch<ProductSummary>(`/products/${encodeURIComponent(id)}`, { auth: false });
  } catch (e) {
    if (e instanceof GatewayError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}
