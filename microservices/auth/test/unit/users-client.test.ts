import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpUsersClient } from "../../src/adapters/users-client.js";
import { INTERNAL_JWT_SECRET, startStubUsers, type StubUsers } from "../support/stub-users.js";

const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";

let users: StubUsers;

beforeAll(async () => {
  users = await startStubUsers();
});

afterAll(async () => {
  await users?.close();
});

const client = (jwtSecret = INTERNAL_JWT_SECRET) => new HttpUsersClient({ baseUrl: users.url, jwtSecret });

describe("HttpUsersClient", () => {
  it("looks the user up with a service token Users accepts (iss auth, aud users, 60 s)", async () => {
    users.answer(USER_ID, { status: 200, body: { user_id: USER_ID, role: "admin", deleted: false } });
    const rejectedBefore = users.rejectedTokens();

    expect(await client().lookup(USER_ID)).toEqual({ kind: "found", user: { role: "admin", deleted: false } });
    expect(users.rejectedTokens()).toBe(rejectedBefore);
  });

  it("maps 404 to no profile", async () => {
    expect(await client().lookup("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toEqual({ kind: "no_profile" });
  });

  it.each([
    { name: "a 500", answer: { status: 500 } },
    { name: "a body outside the contract", answer: { status: 200, body: { user_id: USER_ID, role: "seller", deleted: false } } },
    { name: "another user's record", answer: { status: 200, body: { user_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", role: "admin", deleted: false } } },
  ])("answers unavailable for $name", async ({ answer }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    users.answer(USER_ID, answer);

    expect(await client().lookup(USER_ID)).toEqual({ kind: "unavailable" });
  });

  it("answers unavailable when its token is rejected (secrets differ)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await client("a-different-secret-of-32-characters!!").lookup(USER_ID)).toEqual({ kind: "unavailable" });
  });

  it("answers unavailable when Users is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const down = new HttpUsersClient({ baseUrl: "http://127.0.0.1:9", jwtSecret: INTERNAL_JWT_SECRET });

    expect(await down.lookup(USER_ID)).toEqual({ kind: "unavailable" });
  });
});
