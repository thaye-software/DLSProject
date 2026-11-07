export type ProductSummary = {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
};

export type CatalogLookup = { kind: "found"; product: ProductSummary } | { kind: "not_found" } | { kind: "unavailable" };

export type CatalogClient = {
  getProduct(productId: string): Promise<CatalogLookup>;
};
