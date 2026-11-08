import type { DirectoryUser, UserDirectory, UserLookup } from "./ports/user-directory.js";

export type CacheOptions = {
  // How long a found user is served without asking Users again: the delay before a role change or deletion applies.
  ttlMs: number;
  // While Users is down, a cached user this old is still served rather than failing the request.
  maxStaleMs?: number;
  maxEntries?: number;
  now?: () => number;
};

const DEFAULT_MAX_STALE_MS = 5 * 60_000;
const DEFAULT_MAX_ENTRIES = 10_000;

type Entry = { user: DirectoryUser; fetchedAt: number };

// Every gateway request is a lookup, so Users is asked at most once per user per TTL. "No profile" is never
// cached: the request right after POST /users must already see the new profile.
export class CachedUserDirectory implements UserDirectory {
  private readonly entries = new Map<string, Entry>();
  // Concurrent misses for one user share one call to Users.
  private readonly inFlight = new Map<string, Promise<UserLookup>>();
  private readonly ttlMs: number;
  private readonly maxStaleMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: UserDirectory,
    { ttlMs, maxStaleMs = DEFAULT_MAX_STALE_MS, maxEntries = DEFAULT_MAX_ENTRIES, now = Date.now }: CacheOptions,
  ) {
    this.ttlMs = ttlMs;
    this.maxStaleMs = maxStaleMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  async lookup(userId: string): Promise<UserLookup> {
    const cached = this.entries.get(userId);
    if (cached && this.now() - cached.fetchedAt < this.ttlMs) return { kind: "found", user: cached.user };

    const pending = this.inFlight.get(userId);
    if (pending) return pending;
    const fresh = this.refresh(userId, cached).finally(() => this.inFlight.delete(userId));
    this.inFlight.set(userId, fresh);
    return fresh;
  }

  private async refresh(userId: string, cached: Entry | undefined): Promise<UserLookup> {
    const fresh = await this.inner.lookup(userId);
    switch (fresh.kind) {
      case "found":
        this.remember(userId, fresh.user);
        return fresh;
      case "no_profile":
        this.entries.delete(userId);
        return fresh;
      case "unavailable":
        if (cached && this.now() - cached.fetchedAt < this.maxStaleMs) return { kind: "found", user: cached.user };
        return fresh;
    }
  }

  private remember(userId: string, user: DirectoryUser): void {
    // Re-inserting moves the user to the end, so the first key is always the least recently fetched.
    this.entries.delete(userId);
    this.entries.set(userId, { user, fetchedAt: this.now() });
    if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }
}
