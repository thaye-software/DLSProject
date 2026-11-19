import { describe, expect, it } from "vitest";
import { anonymousVisitor, newIdentity, signUp, withFakeToken } from "../support/customers.js";
import { Gateway } from "../support/gateway.js";

describe("signing in through the gateway (Auth + Users)", () => {
  it("rejects a request without a bearer token with 401", async () => {
    const response = await anonymousVisitor().call("orders", "GET", "/orders");

    expect(response.status).toBe(401);
    expect(response.body.type).toBe("https://limitedwatches.dk/problems/unauthorized");
  });

  it("rejects a token Auth cannot verify with 401", async () => {
    const response = await new Gateway("not-a-supabase-token").call("orders", "GET", "/orders");

    expect(response.status).toBe(401);
  });

  it("lets a new user only create a profile, then everything else", async () => {
    const identity = newIdentity();
    const api = withFakeToken(identity.id, identity.email);

    const beforeProfile = await api.call("orders", "GET", "/orders");
    expect(beforeProfile.status).toBe(403);
    expect(beforeProfile.body.type).toBe("https://limitedwatches.dk/problems/profile_required");

    const created = await api.call("users", "POST", "/users", { body: { username: identity.username } });
    expect(created.status).toBe(201);

    const profile = await api.call("users", "GET", "/users/me");
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ user_id: identity.id, username: identity.username, email: identity.email, role: "customer" });

    const orders = await api.call("orders", "GET", "/orders");
    expect(orders.status).toBe(200);
    expect(orders.body.total).toBe(0);
  });

  it("refuses a second profile with a taken username with 409", async () => {
    const first = await signUp();
    const second = newIdentity();

    const response = await withFakeToken(second.id, second.email).call("users", "POST", "/users", { body: { username: first.username } });

    expect(response.status).toBe(409);
  });
});
