import { z } from "zod";
import type { CatalogClient, CatalogLookup } from "../../application/ports/catalog-client.js";

const REQUEST_TIMEOUT_MS = 5000;

const productSchema = z.object({
  product_id: z.uuid(),
  name: z.string().min(1),
  thumbnail_url: z.string().nullable(),
});

export class HttpCatalogClient implements CatalogClient {
  private readonly baseUrl: URL;

  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  async getProduct(productId: string): Promise<CatalogLookup> {
    let response: Response;
    try {
      response = await fetch(new URL(`products/${encodeURIComponent(productId)}`, this.baseUrl), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { kind: "unavailable" };
    }

    if (response.status === 404) return { kind: "not_found" };
    if (!response.ok) return { kind: "unavailable" };

    const product = productSchema.safeParse(await response.json().catch(() => null));
    if (!product.success) return { kind: "unavailable" };
    return {
      kind: "found",
      product: {
        productId: product.data.product_id,
        name: product.data.name,
        thumbnailUrl: product.data.thumbnail_url,
      },
    };
  }
}
