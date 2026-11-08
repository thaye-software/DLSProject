import { describe, expect, it } from "vitest";
import { avatarPath, detectAvatarType } from "../../src/domain/avatar.js";
import { buildUserDeletedEvent } from "../../src/domain/user-event.js";
import { anonymisedProfile } from "../../src/domain/user.js";
import { JPEG_BYTES, PNG_BYTES, USER_ID } from "../fixtures/users.js";
import { asyncApi, eventSchema } from "../support/contract.js";

describe("buildUserDeletedEvent", () => {
  const event = buildUserDeletedEvent({
    id: "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b",
    userId: USER_ID,
    version: 7,
    deletedAt: new Date("2026-10-14T12:00:00Z"),
  });

  it("builds a CloudEvent that matches UserDeletedEvent in asyncapi.yaml", () => {
    const validate = eventSchema("UserDeletedEvent");

    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it("has the same shape as the contract's example", () => {
    const example = asyncApi.components.messages.UserDeleted.examples[0].payload;
    // Timestamps are compared as instants: the example has no milliseconds, toISOString always writes them.
    expect({ ...event, time: example.time, data: { ...event.data, deleted_at: example.data.deleted_at } }).toEqual(example);
    expect(new Date(event.data.deleted_at)).toEqual(new Date(example.data.deleted_at));
  });
});

describe("anonymisedProfile", () => {
  it("clears every personal field and keeps username and email unique per user", () => {
    expect(anonymisedProfile(USER_ID)).toEqual({
      username: `deleted_${USER_ID}`,
      email: `deleted_${USER_ID}@deleted.invalid`,
      firstName: null,
      middleName: null,
      lastName: null,
      phone: null,
      countryCode: null,
      avatarUrl: null,
    });
  });
});

describe("detectAvatarType", () => {
  it("recognises PNG and JPEG by their bytes", () => {
    expect(detectAvatarType(PNG_BYTES)?.contentType).toBe("image/png");
    expect(detectAvatarType(JPEG_BYTES)?.contentType).toBe("image/jpeg");
  });

  it.each([
    { name: "a GIF", bytes: Buffer.from("GIF89a") },
    { name: "an empty file", bytes: Buffer.alloc(0) },
    { name: "a truncated PNG signature", bytes: PNG_BYTES.subarray(0, 4) },
  ])("rejects $name", ({ bytes }) => {
    expect(detectAvatarType(bytes)).toBeNull();
  });

  it("stores avatars as {user_id}.{ext}, as the monolith did", () => {
    expect(avatarPath(USER_ID, detectAvatarType(JPEG_BYTES)!)).toBe(`${USER_ID}.jpg`);
  });
});
