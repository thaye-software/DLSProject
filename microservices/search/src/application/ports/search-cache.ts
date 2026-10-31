import type { SearchResult } from "../../domain/listing.js";

export type SearchCache = {
  // Bumped whenever the index changes; every cached result is keyed with it, so one INCR invalidates them all.
  generation(): Promise<number>;
  get(key: string): Promise<SearchResult | null>;
  set(key: string, result: SearchResult): Promise<void>;
  bump(): Promise<void>;
};
