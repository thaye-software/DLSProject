import "server-only";
import { GatewayError, gatewayFetch } from "@/lib/gateway";
import type { Money } from "@/lib/money";

// Typed from docs/contracts/openapi.yaml (ProductListing, SearchResults)
export type Availability = "available" | "reserved" | "sold" | "hidden";
export type ProductListing = {
  product_id: string;
  name: string;
  slug: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  model: string | null;
  reference: string | null;
  year: number | null;
  size_mm: number | null;
  condition: number | null;
  limited: boolean | null;
  price: Money;
  availability: Availability;
  thumbnail_url: string | null;
};
export type SearchResults = { items: ProductListing[]; page: number; page_size: number; total: number };

export type SearchFilters = {
  q?: string;
  brand?: string;
  availability?: string;
  minPriceDkk?: number;
  maxPriceDkk?: number;
  page?: number;
  pageSize?: number;
};

const toMinor = (dkk?: number) => (dkk === undefined ? undefined : Math.round(dkk * 100));

export function toSearchQuery(f: SearchFilters): Record<string, string | number | undefined> {
  return {
    q: f.q || undefined,
    brand: f.brand,
    availability: f.availability,
    min_price: toMinor(f.minPriceDkk),
    max_price: toMinor(f.maxPriceDkk),
    page: f.page,
    page_size: f.pageSize,
  };
}

type Params = Record<string, string | string[] | undefined>;

// Parses page searchParams into filters; non-numeric prices/pages are dropped.
export function filtersFromParams(params: Params): SearchFilters {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) || undefined;
  const num = (k: string) => {
    const n = Number(one(k));
    return one(k) !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  return {
    q: one("q"),
    brand: one("brand"),
    availability: one("availability"),
    minPriceDkk: num("minPrice"),
    maxPriceDkk: num("maxPrice"),
    page: num("page"),
  };
}

export function searchProducts(filters: SearchFilters): Promise<SearchResults> {
  return gatewayFetch<SearchResults>("/search", { query: toSearchQuery(filters), auth: false });
}

export function watchHref(listing: Pick<ProductListing, "product_id" | "slug">): string {
  return `/watches/view/${listing.product_id}/${listing.slug}`;
}

const GENERIC_ERROR = "Watches could not be loaded right now. Please try again later.";

// Shows the service's problem+json title/detail when there is one; logs everything else.
export function searchErrorMessage(e: unknown): string {
  if (e instanceof GatewayError && e.problem) {
    return [e.problem.title, e.problem.detail].filter(Boolean).join(": ");
  }
  console.error("Search failed", e);
  return GENERIC_ERROR;
}
