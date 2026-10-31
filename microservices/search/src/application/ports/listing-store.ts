import type { Brand, Listing, SearchQuery, SearchResult, Availability } from "../../domain/listing.js";

// "stale": the store already has this version or a newer one (a redelivered or reordered event).
export type WriteResult = "written" | "stale";
// "unknown": no listing for the product, so there was nothing to change.
export type AvailabilityResult = WriteResult | "unknown";

export type ListingStore = {
  // Replaces the listing, or creates it, only if `version` is newer than the stored one.
  upsert(listing: Listing): Promise<WriteResult>;
  // Leaves a tombstone with the version, so an older reordered event can't bring the listing back. Also how a hidden
  // product is kept out of the index; a newer snapshot replaces the tombstone.
  markDeleted(productId: string, version: number): Promise<WriteResult>;
  setAvailability(productId: string, version: number, availability: Availability, at: Date): Promise<AvailabilityResult>;
  // Stores the brand and renames it on all its listings; returns how many listings changed.
  updateBrand(brand: Brand): Promise<{ result: WriteResult; listings: number }>;
  search(query: SearchQuery): Promise<SearchResult>;
};
