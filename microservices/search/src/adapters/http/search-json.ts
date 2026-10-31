import { z } from "zod";
import { SEARCHABLE_AVAILABILITIES, type Listing, type SearchQuery, type SearchResult } from "../../domain/listing.js";

// Query of GET /search (docs/contracts/openapi.yaml). Express parses a repeated ?availability= into an array and a
// single one into a string.
const availabilitySchema = z.enum(SEARCHABLE_AVAILABILITIES);
const price = z.coerce.number().int().min(0).optional();

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    brand: z.string().trim().min(1).optional(),
    availability: z
      .union([availabilitySchema, z.array(availabilitySchema).min(1)])
      .optional()
      .transform((value): (typeof SEARCHABLE_AVAILABILITIES)[number][] =>
        value === undefined ? ["available"] : Array.isArray(value) ? value : [value],
      ),
    min_price: price,
    max_price: price,
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((query) => query.min_price === undefined || query.max_price === undefined || query.min_price <= query.max_price, {
    message: "min_price must not be above max_price",
    path: ["min_price"],
  })
  .transform(
    (query): SearchQuery => ({
      q: query.q ? query.q : null,
      brand: query.brand ?? null,
      availability: query.availability,
      minPriceDkk: query.min_price ?? null,
      maxPriceDkk: query.max_price ?? null,
      page: query.page,
      pageSize: query.page_size,
    }),
  );

// The ProductListing schema.
function listingJson(listing: Listing) {
  return {
    product_id: listing.productId,
    name: listing.name,
    slug: listing.slug,
    brand_id: listing.brandId,
    brand_name: listing.brandName,
    brand_slug: listing.brandSlug,
    model: listing.model,
    reference: listing.reference,
    year: listing.year,
    size_mm: listing.sizeMm,
    condition: listing.condition,
    limited: listing.limited,
    price: { amount_minor: listing.priceDkk, currency: "DKK" },
    availability: listing.availability,
    thumbnail_url: listing.thumbnailUrl,
  };
}

// The SearchResults schema.
export function searchResultsJson(result: SearchResult, query: SearchQuery) {
  return { items: result.items.map(listingJson), page: query.page, page_size: query.pageSize, total: result.total };
}
