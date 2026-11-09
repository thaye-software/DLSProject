import { describe, expect, it } from "vitest";
import { ROUTES, matchRoute } from "../../src/routes.js";

describe("matchRoute", () => {
  it.each(ROUTES.map((r) => [r.prefix, r.service] as const))("%s -> %s", (prefix, service) => {
    expect(matchRoute(prefix)?.service).toBe(service);
    expect(matchRoute(`${prefix}/abc/cancel`)?.service).toBe(service);
  });

  it("ignores the query string", () => {
    expect(matchRoute("/search?q=x")?.service).toBe("search");
  });

  it.each(["/ordersx", "/", "/unknown"])("%s -> null", (path) => {
    expect(matchRoute(path)).toBeNull();
  });

  it.each([
    "/internal/reservations",
    "/Internal/reservations",
    "//internal/x",
    "/orders/..%2Finternal/reservations",
    "/orders/%E0%A4%A",
  ])("%s -> null", (path) => {
    expect(matchRoute(path)).toBeNull();
  });
});
