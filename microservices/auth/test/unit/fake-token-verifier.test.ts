import { describe, expect, it } from "vitest";
import { FakeTokenVerifier } from "../../src/adapters/fake-token-verifier.js";

const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const verifier = new FakeTokenVerifier();

describe("FakeTokenVerifier", () => {
  it("takes fake:<user id> as that user, with an email made from the id", async () => {
    expect(await verifier.verify(`fake:${USER_ID}`)).toEqual({
      kind: "valid",
      token: { userId: USER_ID, email: `${USER_ID}@fake.invalid` },
    });
  });

  it("uses the email given after the user id", async () => {
    expect(await verifier.verify(`fake:${USER_ID}:mette@example.com`)).toEqual({
      kind: "valid",
      token: { userId: USER_ID, email: "mette@example.com" },
    });
  });

  it("lower-cases the user id, as Supabase's sub always is", async () => {
    expect(await verifier.verify(`fake:${USER_ID.toUpperCase()}`)).toMatchObject({ token: { userId: USER_ID } });
  });

  it.each([
    { name: "a real JWT", token: "abc.def.ghi", reason: "expected fake:<user id>[:<email>]" },
    { name: "no user id", token: "fake:", reason: "sub is not a user id" },
    { name: "a user id that is no uuid", token: "fake:mette", reason: "sub is not a user id" },
    { name: "an empty email", token: `fake:${USER_ID}:`, reason: "token has no email" },
    { name: "an invalid email", token: `fake:${USER_ID}:mette`, reason: "token has no email" },
  ])("rejects $name", async ({ token, reason }) => {
    expect(await verifier.verify(token)).toEqual({ kind: "invalid", reason });
  });
});
