import { describe, expect, it, vi } from "vitest";
import { MAX_AVATAR_BYTES } from "../../src/domain/avatar.js";
import { aUser, JPEG_BYTES, PNG_BYTES, USER_ID } from "../fixtures/users.js";
import { contractSchema } from "../support/contract.js";
import { serve } from "../support/serve.js";

const asUser = { "x-user-id": USER_ID, "x-user-email": "mette@example.com" };
const json = { "content-type": "application/json" };

async function expectUser(response: Response, status = 200) {
  expect(response.status).toBe(status);
  const body = await response.json();
  const validate = contractSchema("User");
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  return body;
}

async function expectProblem(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  const body = await response.json();
  const validate = contractSchema("Problem");
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  expect(body.type).toBe(`https://limitedwatches.dk/problems/${code}`);
  return body;
}

describe("gateway headers", () => {
  it.each([
    ["GET", "/users/me"],
    ["PATCH", "/users/me"],
    ["DELETE", "/users/me"],
    ["PUT", "/users/me/address"],
    ["DELETE", "/users/me/address"],
    ["PUT", "/users/me/avatar"],
    ["POST", "/users"],
  ])("%s %s answers 401 without a valid X-User-Id", async (method, path) => {
    const baseUrl = await serve();

    const response = await fetch(`${baseUrl}${path}`, { method, headers: { "x-user-id": "not-a-uuid" } });

    await expectProblem(response, 401, "unauthorized");
  });
});

describe("POST /users", () => {
  const post = (baseUrl: string, body: unknown, headers: Record<string, string> = asUser) =>
    fetch(`${baseUrl}/users`, { method: "POST", headers: { ...json, ...headers }, body: JSON.stringify(body) });

  it("creates the user from the gateway headers and answers 201", async () => {
    const createUser = vi.fn(async () => ({ kind: "created" as const, user: aUser({ version: 1, address: null }) }));
    const baseUrl = await serve({ createUser });

    const body = await expectUser(await post(baseUrl, { username: "mette_j" }), 201);

    expect(createUser).toHaveBeenCalledWith({ id: USER_ID, username: "mette_j", email: "mette@example.com" });
    expect(body.user_id).toBe(USER_ID);
  });

  it("answers 200 with the existing user when repeated", async () => {
    const baseUrl = await serve({ createUser: async () => ({ kind: "exists", user: aUser() }) });

    await expectUser(await post(baseUrl, { username: "mette_j" }), 200);
  });

  it("needs X-User-Email as well", async () => {
    const baseUrl = await serve();

    await expectProblem(await post(baseUrl, { username: "mette_j" }, { "x-user-id": USER_ID }), 401, "unauthorized");
  });

  it.each([
    { kind: "username_taken" as const, code: "username_taken" },
    { kind: "email_taken" as const, code: "email_taken" },
    { kind: "account_deleted" as const, code: "account_deleted" },
  ])("answers 409 $code", async ({ kind, code }) => {
    const baseUrl = await serve({ createUser: async () => ({ kind }) });

    await expectProblem(await post(baseUrl, { username: "mette_j" }), 409, code);
  });

  it.each([
    { name: "too short", body: { username: "mj" }, message: "at least 3" },
    { name: "too long", body: { username: "m".repeat(33) }, message: "at most 32" },
    { name: "a space", body: { username: "mette j" }, message: "Only letters" },
    { name: "an extra field", body: { username: "mette_j", role: "admin" }, message: "role" },
  ])("answers 422 for a username with $name", async ({ body, message }) => {
    const createUser = vi.fn();
    const baseUrl = await serve({ createUser });

    const problem = await expectProblem(await post(baseUrl, body), 422, "validation_error");

    expect(problem.detail).toContain(message);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers 422 for malformed JSON", async () => {
    const baseUrl = await serve();

    const response = await fetch(`${baseUrl}/users`, { method: "POST", headers: { ...json, ...asUser }, body: "{" });

    await expectProblem(response, 422, "validation_error");
  });
});

describe("GET /users/username-available", () => {
  it("answers whether the username is free, without login", async () => {
    const baseUrl = await serve({ isUsernameTaken: async (username) => username === "mette_j" });

    const taken = await fetch(`${baseUrl}/users/username-available?username=mette_j`);
    const free = await fetch(`${baseUrl}/users/username-available?username=lars.k`);

    const validate = contractSchema("UsernameAvailability");
    const [takenBody, freeBody] = [await taken.json(), await free.json()];
    expect(validate(takenBody) && validate(freeBody)).toBe(true);
    expect(takenBody).toEqual({ username: "mette_j", available: false });
    expect(freeBody).toEqual({ username: "lars.k", available: true });
  });

  it("answers 422 for an invalid username", async () => {
    const baseUrl = await serve();

    await expectProblem(await fetch(`${baseUrl}/users/username-available?username=a`), 422, "validation_error");
  });
});

describe("GET /users/me", () => {
  it("answers the profile with its address", async () => {
    const baseUrl = await serve({ getProfile: async () => aUser() });

    const body = await expectUser(await fetch(`${baseUrl}/users/me`, { headers: asUser }));

    expect(body.address).toEqual({
      address_line_1: "Nørregade 12",
      address_line_2: null,
      city: "København K",
      zip_code: "1165",
      state_province: null,
    });
  });

  it("answers 404 when there is no profile", async () => {
    const baseUrl = await serve();

    await expectProblem(await fetch(`${baseUrl}/users/me`, { headers: asUser }), 404, "not_found");
  });
});

describe("PATCH /users/me", () => {
  const patch = (baseUrl: string, body: unknown) =>
    fetch(`${baseUrl}/users/me`, { method: "PATCH", headers: { ...json, ...asUser }, body: JSON.stringify(body) });

  it("passes only the fields sent, with null clearing a field", async () => {
    const updateProfile = vi.fn(async () => ({ kind: "updated" as const, user: aUser() }));
    const baseUrl = await serve({ updateProfile });

    await expectUser(await patch(baseUrl, { first_name: " Mette ", middle_name: null, country_code: "DK" }));

    expect(updateProfile).toHaveBeenCalledWith(USER_ID, { firstName: "Mette", middleName: null, countryCode: "DK" });
  });

  it.each([
    { name: "an empty body", body: {} },
    { name: "a lower-case country code", body: { country_code: "dk" } },
    { name: "a phone longer than 20", body: { phone: "+45 ".repeat(6) } },
    { name: "an empty first name", body: { first_name: "  " } },
    { name: "email (changed through Supabase Auth)", body: { email: "new@example.com" } },
  ])("answers 422 for $name", async ({ body }) => {
    const baseUrl = await serve();

    await expectProblem(await patch(baseUrl, body), 422, "validation_error");
  });

  it("answers 409 when the username is taken", async () => {
    const baseUrl = await serve({ updateProfile: async () => ({ kind: "username_taken" }) });

    await expectProblem(await patch(baseUrl, { username: "lars.k" }), 409, "username_taken");
  });

  it("answers 404 for a deleted or missing user", async () => {
    const baseUrl = await serve();

    await expectProblem(await patch(baseUrl, { first_name: "Mette" }), 404, "not_found");
  });
});

describe("DELETE /users/me", () => {
  it.each(["deleted", "already_deleted"] as const)("answers 204 when %s", async (result) => {
    const deleteAccount = vi.fn(async () => result);
    const baseUrl = await serve({ deleteAccount });

    const response = await fetch(`${baseUrl}/users/me`, { method: "DELETE", headers: asUser });

    expect(response.status).toBe(204);
    expect(deleteAccount).toHaveBeenCalledWith(USER_ID);
  });

  it("answers 404 for an unknown user", async () => {
    const baseUrl = await serve();

    await expectProblem(await fetch(`${baseUrl}/users/me`, { method: "DELETE", headers: asUser }), 404, "not_found");
  });
});

describe("PUT /users/me/address", () => {
  const put = (baseUrl: string, body: unknown) =>
    fetch(`${baseUrl}/users/me/address`, { method: "PUT", headers: { ...json, ...asUser }, body: JSON.stringify(body) });

  it("saves the address, treating missing or empty optional lines as null", async () => {
    const setAddress = vi.fn(async () => aUser());
    const baseUrl = await serve({ setAddress });

    await expectUser(await put(baseUrl, { address_line_1: "Nørregade 12", address_line_2: "", city: "København K", zip_code: "1165" }));

    expect(setAddress).toHaveBeenCalledWith(USER_ID, {
      addressLine1: "Nørregade 12",
      addressLine2: null,
      city: "København K",
      zipCode: "1165",
      stateProvince: null,
    });
  });

  it("answers 422 without a city", async () => {
    const baseUrl = await serve();

    await expectProblem(await put(baseUrl, { address_line_1: "Nørregade 12", zip_code: "1165" }), 422, "validation_error");
  });
});

describe("DELETE /users/me/address", () => {
  it("answers 204", async () => {
    const baseUrl = await serve({ removeAddress: async () => aUser({ address: null }) });

    const response = await fetch(`${baseUrl}/users/me/address`, { method: "DELETE", headers: asUser });

    expect(response.status).toBe(204);
  });

  it("answers 404 for a deleted or missing user", async () => {
    const baseUrl = await serve();

    await expectProblem(await fetch(`${baseUrl}/users/me/address`, { method: "DELETE", headers: asUser }), 404, "not_found");
  });
});

describe("PUT /users/me/avatar", () => {
  const put = (baseUrl: string, contentType: string, body: Buffer) =>
    fetch(`${baseUrl}/users/me/avatar`, { method: "PUT", headers: { ...asUser, "content-type": contentType }, body: new Uint8Array(body) });

  it.each([
    { contentType: "image/png", bytes: PNG_BYTES },
    { contentType: "image/jpeg", bytes: JPEG_BYTES },
  ])("passes a $contentType body to the upload", async ({ contentType, bytes }) => {
    const uploadAvatar = vi.fn(async () => ({ kind: "updated" as const, user: aUser({ avatarUrl: "https://xyz.supabase.co/a.png?v=5" }) }));
    const baseUrl = await serve({ uploadAvatar });

    await expectUser(await put(baseUrl, contentType, bytes));

    expect(uploadAvatar).toHaveBeenCalledWith(USER_ID, contentType, bytes);
  });

  it("answers 415 for another content type without reading it", async () => {
    const uploadAvatar = vi.fn();
    const baseUrl = await serve({ uploadAvatar });

    await expectProblem(await put(baseUrl, "image/gif", PNG_BYTES), 415, "unsupported_media_type");
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("answers 415 when the bytes do not match", async () => {
    const baseUrl = await serve({ uploadAvatar: async () => ({ kind: "unsupported" }) });

    await expectProblem(await put(baseUrl, "image/png", JPEG_BYTES), 415, "unsupported_media_type");
  });

  it("answers 413 above 5 MB", async () => {
    const uploadAvatar = vi.fn();
    const baseUrl = await serve({ uploadAvatar });

    const tooLarge = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_AVATAR_BYTES)]);
    await expectProblem(await put(baseUrl, "image/png", tooLarge), 413, "payload_too_large");
    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});

describe("unexpected errors", () => {
  it("answers 500 problem+json when a dependency throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const baseUrl = await serve({
      getProfile: async () => {
        throw new Error("database down");
      },
    });

    await expectProblem(await fetch(`${baseUrl}/users/me`, { headers: asUser }), 500, "internal_error");
  });
});
