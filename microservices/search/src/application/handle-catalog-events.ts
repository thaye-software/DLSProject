import type { Availability, Brand, Listing } from "../domain/listing.js";
import type { Inbox } from "./ports/inbox.js";
import type { ListingStore } from "./ports/listing-store.js";
import type { SearchCache } from "./ports/search-cache.js";

export type CatalogEventDependencies = {
  store: ListingStore;
  inbox: Inbox;
  cache: SearchCache;
};

export type Outcome = { kind: "duplicate" } | { kind: "applied" | "stale" | "unknown"; note: string };

// Skips an event id already handled, runs the change, drops the cached results if the index changed, and records
// the id last: if the change fails nothing is recorded and the retry runs it again. Every change is idempotent
// through the version rules, so a crash between the change and the record only repeats a no-op.
async function once(
  eventId: string,
  type: string,
  { inbox, cache }: CatalogEventDependencies,
  change: () => Promise<{ outcome: "written" | "stale" | "unknown"; note: string }>,
): Promise<Outcome> {
  if (await inbox.has(eventId)) return { kind: "duplicate" };

  const { outcome, note } = await change();
  if (outcome === "written") {
    // A cache failure must not fail the event; results expire on their own through the TTL.
    await cache.bump().catch((error) => console.error("Could not invalidate the search cache", error));
  }
  await inbox.record(eventId, type);
  return { kind: outcome === "written" ? "applied" : outcome, note };
}

export function onProductSnapshot(
  eventId: string,
  type: "product_created" | "product_updated",
  listing: Listing,
  dependencies: CatalogEventDependencies,
): Promise<Outcome> {
  return once(eventId, type, dependencies, async () => {
    // A hidden product is not indexed: it is stored as a tombstone, which keeps its version and gives way to the
    // next snapshot with a newer version once an admin makes it visible again.
    const hidden = listing.availability === "hidden";
    const result = hidden ? await dependencies.store.markDeleted(listing.productId, listing.version) : await dependencies.store.upsert(listing);
    return {
      outcome: result,
      note: `product ${listing.productId} v${listing.version} ${result === "written" ? (hidden ? "hidden, not indexed" : "indexed") : "ignored, an equal or newer version is stored"}`,
    };
  });
}

export function onProductDeleted(eventId: string, productId: string, version: number, dependencies: CatalogEventDependencies): Promise<Outcome> {
  return once(eventId, "product_deleted", dependencies, async () => {
    const result = await dependencies.store.markDeleted(productId, version);
    return { outcome: result, note: `product ${productId} v${version} ${result === "written" ? "removed" : "ignored, an equal or newer version is stored"}` };
  });
}

// Catalog publishes this for every reservation and release, including for products whose product_created Search
// never saw. Those are acknowledged and logged, never retried: there is no listing to change, and the full snapshot
// arrives with the product's next product_created / product_updated.
export function onAvailabilityChanged(
  eventId: string,
  productId: string,
  version: number,
  availability: Availability,
  changedAt: Date,
  dependencies: CatalogEventDependencies,
): Promise<Outcome> {
  return once(eventId, "product_availability_changed", dependencies, async () => {
    if (availability === "hidden") {
      const hidden = await dependencies.store.markDeleted(productId, version);
      return { outcome: hidden, note: `product ${productId} v${version} ${hidden === "written" ? "hidden, removed from the index" : "ignored, an equal or newer version is stored"}` };
    }
    const result = await dependencies.store.setAvailability(productId, version, availability, changedAt);
    const note =
      result === "written"
        ? `product ${productId} v${version} is now ${availability}`
        : result === "unknown"
          ? `product ${productId} has no listing yet, availability ${availability} ignored`
          : `product ${productId} v${version} ignored, an equal or newer version is stored`;
    return { outcome: result, note };
  });
}

export function onBrandUpdated(eventId: string, brand: Brand, dependencies: CatalogEventDependencies): Promise<Outcome> {
  return once(eventId, "brand_updated", dependencies, async () => {
    const { result, listings } = await dependencies.store.updateBrand(brand);
    return {
      outcome: result,
      note: `brand ${brand.slug} v${brand.version} ${result === "written" ? `renamed on ${listings} listing(s)` : "ignored, an equal or newer version is stored"}`,
    };
  });
}
