import type { SearchQuery, SearchResult } from "../domain/listing.js";
import type { ListingStore } from "./ports/listing-store.js";
import type { SearchCache } from "./ports/search-cache.js";

export type SearchDependencies = {
  store: Pick<ListingStore, "search">;
  cache: SearchCache;
};

// Stable for equal queries whatever order the availabilities came in.
export function cacheKey(generation: number, query: SearchQuery): string {
  const { availability, ...rest } = query;
  return `search:${generation}:${JSON.stringify({ ...rest, availability: [...availability].sort() })}`;
}

// The generation is read before the query: if an event bumps it while MongoDB is being read, this result is
// stored under the old generation, which nothing asks for any more, and can't be served as fresh.
// Any Redis failure falls back to MongoDB, so the cache is an optimisation, never a dependency.
export async function searchListings(query: SearchQuery, { store, cache }: SearchDependencies): Promise<SearchResult> {
  let key: string;
  try {
    key = cacheKey(await cache.generation(), query);
    const cached = await cache.get(key);
    if (cached) return cached;
  } catch (error) {
    console.error("Search cache unavailable, reading MongoDB", error);
    return store.search(query);
  }

  const result = await store.search(query);
  await cache.set(key, result).catch((error) => console.error("Could not cache a search result", error));
  return result;
}
