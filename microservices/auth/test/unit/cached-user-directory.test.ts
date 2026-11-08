import { describe, expect, it, vi } from "vitest";
import { CachedUserDirectory } from "../../src/application/cached-user-directory.js";
import type { UserDirectory, UserLookup } from "../../src/application/ports/user-directory.js";

const customer: UserLookup = { kind: "found", user: { role: "customer", deleted: false } };
const admin: UserLookup = { kind: "found", user: { role: "admin", deleted: false } };

function setup(answers: UserLookup[], options: { ttlMs?: number; maxStaleMs?: number; maxEntries?: number } = {}) {
  let clock = 0;
  const inner: UserDirectory = { lookup: vi.fn(async () => answers.shift() ?? customer) };
  const cache = new CachedUserDirectory(inner, { ttlMs: 30_000, ...options, now: () => clock });
  return { cache, inner, advance: (ms: number) => (clock += ms) };
}

describe("CachedUserDirectory", () => {
  it("asks Users once per user within the TTL", async () => {
    const { cache, inner, advance } = setup([customer]);

    await cache.lookup("a");
    advance(29_999);
    expect(await cache.lookup("a")).toEqual(customer);

    expect(inner.lookup).toHaveBeenCalledTimes(1);
  });

  it("asks again after the TTL, so a role change applies", async () => {
    const { cache, advance } = setup([customer, admin]);

    await cache.lookup("a");
    advance(30_000);

    expect(await cache.lookup("a")).toEqual(admin);
  });

  it("never caches a missing profile, so the request after POST /users sees the new one", async () => {
    const { cache, inner } = setup([{ kind: "no_profile" }, customer]);

    expect(await cache.lookup("a")).toEqual({ kind: "no_profile" });
    expect(await cache.lookup("a")).toEqual(customer);
    expect(inner.lookup).toHaveBeenCalledTimes(2);
  });

  it("serves the last known user while Users is down, up to maxStaleMs", async () => {
    const { cache, advance } = setup([customer, { kind: "unavailable" }, { kind: "unavailable" }], { maxStaleMs: 60_000 });

    await cache.lookup("a");
    advance(45_000);
    expect(await cache.lookup("a")).toEqual(customer);
    advance(20_000);
    expect(await cache.lookup("a")).toEqual({ kind: "unavailable" });
  });

  it("answers unavailable for an unknown user while Users is down", async () => {
    const { cache } = setup([{ kind: "unavailable" }]);

    expect(await cache.lookup("a")).toEqual({ kind: "unavailable" });
  });

  it("shares one call to Users between concurrent misses for the same user", async () => {
    const { cache, inner } = setup([customer]);

    await Promise.all([cache.lookup("a"), cache.lookup("a"), cache.lookup("a")]);

    expect(inner.lookup).toHaveBeenCalledTimes(1);
  });

  it("drops the least recently fetched user above maxEntries", async () => {
    const { cache, inner } = setup([], { maxEntries: 2 });

    await cache.lookup("a");
    await cache.lookup("b");
    await cache.lookup("c");
    await cache.lookup("b");
    await cache.lookup("a");

    expect(vi.mocked(inner.lookup).mock.calls.map(([id]) => id)).toEqual(["a", "b", "c", "a"]);
  });
});
