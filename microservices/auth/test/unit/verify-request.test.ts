import { describe, expect, it, vi } from "vitest";
import type { TokenCheck, TokenVerifier } from "../../src/application/ports/token-verifier.js";
import type { UserDirectory, UserLookup } from "../../src/application/ports/user-directory.js";
import { pathOf, verifyRequest, type GatewayRequest } from "../../src/application/verify-request.js";

const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const valid: TokenCheck = { kind: "valid", token: { userId: USER_ID, email: "mette@example.com" } };
const customer: UserLookup = { kind: "found", user: { role: "customer", deleted: false } };

function run(request: Partial<GatewayRequest>, check: TokenCheck = valid, lookup: UserLookup = customer) {
  const tokens: TokenVerifier = { verify: vi.fn(async () => check) };
  const users: UserDirectory = { lookup: vi.fn(async () => lookup) };
  const result = verifyRequest({ authorization: "Bearer abc.def.ghi", method: "GET", uri: "/orders", ...request }, { tokens, users });
  return { result, tokens, users };
}

describe("verifyRequest", () => {
  it("allows a signed-in user with the role from Users and the email from the token", async () => {
    const { result, tokens, users } = run({});

    expect(await result).toEqual({ kind: "allowed", userId: USER_ID, email: "mette@example.com", role: "customer" });
    expect(tokens.verify).toHaveBeenCalledWith("abc.def.ghi");
    expect(users.lookup).toHaveBeenCalledWith(USER_ID);
  });

  it("passes the admin role through", async () => {
    const { result } = run({}, valid, { kind: "found", user: { role: "admin", deleted: false } });

    expect(await result).toMatchObject({ kind: "allowed", role: "admin" });
  });

  it.each([
    { name: "no Authorization header", authorization: undefined },
    { name: "a Basic header", authorization: "Basic dXNlcjpwYXNz" },
    { name: "an empty bearer", authorization: "Bearer " },
  ])("answers unauthorized for $name without checking anything", async ({ authorization }) => {
    const { result, tokens } = run({ authorization });

    expect(await result).toEqual({ kind: "unauthorized", detail: "no bearer token" });
    expect(tokens.verify).not.toHaveBeenCalled();
  });

  it("passes the verifier's reason on and does not ask Users", async () => {
    const { result, users } = run({}, { kind: "invalid", reason: "token expired" });

    expect(await result).toEqual({ kind: "unauthorized", detail: "token expired" });
    expect(users.lookup).not.toHaveBeenCalled();
  });

  it("answers signing_keys_unavailable when the token cannot be checked", async () => {
    expect(await run({}, { kind: "unavailable" }).result).toEqual({ kind: "signing_keys_unavailable" });
  });

  it("rejects a deleted account", async () => {
    expect(await run({}, valid, { kind: "found", user: { role: "customer", deleted: true } }).result).toEqual({ kind: "account_deleted" });
  });

  it("answers users_unavailable when the role cannot be looked up", async () => {
    expect(await run({}, valid, { kind: "unavailable" }).result).toEqual({ kind: "users_unavailable" });
  });

  describe("a user without a profile", () => {
    it.each([
      { method: "POST", uri: "/users" },
      { method: "post", uri: "/users/" },
      { method: "POST", uri: "/users?source=signup" },
    ])("may call $method $uri, as a customer", async ({ method, uri }) => {
      expect(await run({ method, uri }, valid, { kind: "no_profile" }).result).toMatchObject({ kind: "allowed", role: "customer" });
    });

    it.each([
      { method: "GET", uri: "/users" },
      { method: "POST", uri: "/users/me" },
      { method: "POST", uri: "/orders" },
      { method: "POST", uri: "/users/../orders" },
      { method: undefined, uri: undefined },
    ])("may not call $method $uri", async ({ method, uri }) => {
      expect(await run({ method, uri }, valid, { kind: "no_profile" }).result).toEqual({ kind: "profile_required" });
    });
  });
});

describe("pathOf", () => {
  it.each([
    ["/orders?page=2", "/orders"],
    ["/users/me#top", "/users/me"],
    [undefined, ""],
  ])("%s → %s", (uri, path) => {
    expect(pathOf(uri)).toBe(path);
  });
});
