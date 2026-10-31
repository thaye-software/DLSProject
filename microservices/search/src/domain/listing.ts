export const AVAILABILITIES = ["available", "reserved", "sold", "hidden"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

// What a search can ask for: hidden products are never returned.
export const SEARCHABLE_AVAILABILITIES = ["available", "reserved", "sold"] as const;
export type SearchableAvailability = (typeof SEARCHABLE_AVAILABILITIES)[number];

// One document of product_listings (docs/microservice-erd.drawio), built from catalog.events.
// Prices are DKK in øre.
export type Listing = {
  productId: string;
  version: number;
  name: string;
  slug: string;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  model: string | null;
  reference: string | null;
  year: number | null;
  sizeMm: number | null;
  condition: number | null;
  limited: boolean | null;
  priceDkk: number;
  availability: Availability;
  thumbnailUrl: string | null;
  updatedAt: Date;
};

export type Brand = { brandId: string; name: string; slug: string; version: number };

export type SearchQuery = {
  q: string | null;
  // Brand slug.
  brand: string | null;
  availability: SearchableAvailability[];
  minPriceDkk: number | null;
  maxPriceDkk: number | null;
  page: number;
  pageSize: number;
};

export type SearchResult = { items: Listing[]; total: number };
