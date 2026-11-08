import { describe, expect, it, vi } from "vitest";
import { deleteAccount } from "../../src/application/delete-account.js";
import type { AvatarStorage } from "../../src/application/ports/avatar-storage.js";
import type { IdentityProvider } from "../../src/application/ports/identity-provider.js";
import type { SoftDeleteInput, UserStore } from "../../src/application/ports/user-store.js";
import { purgeDeletedAccounts } from "../../src/application/purge-deleted-accounts.js";
import { syncConfirmedEmail } from "../../src/application/sync-email.js";
import { updateProfile } from "../../src/application/update-profile.js";
import { uploadAvatar } from "../../src/application/upload-avatar.js";
import { aUser, JPEG_BYTES, OTHER_USER_ID, PNG_BYTES, USER_ID } from "../fixtures/users.js";
import { eventSchema } from "../support/contract.js";

function fakeStore(overrides: Partial<UserStore> = {}): UserStore {
  const notStubbed = (name: string) => async () => {
    throw new Error(`${name} not stubbed`);
  };
  return {
    create: notStubbed("create"),
    findActive: notStubbed("findActive"),
    find: notStubbed("find"),
    isUsernameTaken: notStubbed("isUsernameTaken"),
    updateProfile: notStubbed("updateProfile"),
    setAddress: notStubbed("setAddress"),
    removeAddress: notStubbed("removeAddress"),
    setAvatarUrl: notStubbed("setAvatarUrl"),
    syncEmail: notStubbed("syncEmail"),
    softDelete: notStubbed("softDelete"),
    pendingAuthDeletions: notStubbed("pendingAuthDeletions"),
    markAuthDeleted: notStubbed("markAuthDeleted"),
    ...overrides,
  };
}

const fakeIdentity = (overrides: Partial<IdentityProvider> = {}): IdentityProvider => ({
  setDisplayName: vi.fn(async () => undefined),
  deleteUser: vi.fn(async () => undefined),
  ...overrides,
});

const fakeAvatars = (overrides: Partial<AvatarStorage> = {}): AvatarStorage => ({
  upload: vi.fn(async () => "https://xyz.supabase.co/storage/v1/object/public/avatars/a.png"),
  remove: vi.fn(async () => undefined),
  ...overrides,
});

describe("updateProfile", () => {
  it("copies a new username to Supabase display_name", async () => {
    const identity = fakeIdentity();
    const users = fakeStore({ updateProfile: async () => ({ kind: "updated", user: aUser({ username: "lars.k" }) }) });

    await updateProfile(USER_ID, { username: "lars.k" }, { users, identity });

    expect(identity.setDisplayName).toHaveBeenCalledWith(USER_ID, "lars.k");
  });

  it("leaves Supabase alone when the username did not change", async () => {
    const identity = fakeIdentity();
    const users = fakeStore({ updateProfile: async () => ({ kind: "updated", user: aUser() }) });

    await updateProfile(USER_ID, { phone: null }, { users, identity });

    expect(identity.setDisplayName).not.toHaveBeenCalled();
  });

  it("still succeeds when Supabase is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const identity = fakeIdentity({ setDisplayName: vi.fn().mockRejectedValue(new Error("supabase down")) });
    const users = fakeStore({ updateProfile: async () => ({ kind: "updated", user: aUser({ username: "lars.k" }) }) });

    const result = await updateProfile(USER_ID, { username: "lars.k" }, { users, identity });

    expect(result.kind).toBe("updated");
  });
});

describe("uploadAvatar", () => {
  it("uploads and saves the URL with the new version as cache buster", async () => {
    const avatars = fakeAvatars();
    const setAvatarUrl = vi.fn(async (_userId: string, url: (version: number) => string) => aUser({ avatarUrl: url(5), version: 5 }));
    const users = fakeStore({ findActive: async () => aUser(), setAvatarUrl });

    const result = await uploadAvatar(USER_ID, "image/png", PNG_BYTES, { users, avatars });

    expect(avatars.upload).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ extension: "png" }), PNG_BYTES);
    expect(result).toEqual({ kind: "updated", user: expect.objectContaining({ avatarUrl: expect.stringMatching(/a\.png\?v=5$/) }) });
  });

  it("rejects bytes that do not match the content type, before uploading", async () => {
    const avatars = fakeAvatars();

    const result = await uploadAvatar(USER_ID, "image/png", JPEG_BYTES, { users: fakeStore(), avatars });

    expect(result.kind).toBe("unsupported");
    expect(avatars.upload).not.toHaveBeenCalled();
  });

  it("does not upload for a deleted or missing user", async () => {
    const avatars = fakeAvatars();

    const result = await uploadAvatar(USER_ID, "image/jpeg", JPEG_BYTES, { users: fakeStore({ findActive: async () => null }), avatars });

    expect(result.kind).toBe("not_found");
    expect(avatars.upload).not.toHaveBeenCalled();
  });

  it("removes the file again when the account was deleted during the upload", async () => {
    const avatars = fakeAvatars();
    const users = fakeStore({ findActive: async () => aUser(), setAvatarUrl: async () => null });

    const result = await uploadAvatar(USER_ID, "image/jpeg", JPEG_BYTES, { users, avatars });

    expect(result.kind).toBe("not_found");
    expect(avatars.remove).toHaveBeenCalledWith(USER_ID);
  });
});

describe("deleteAccount", () => {
  it("soft deletes with an anonymised profile and a contract-valid user_deleted for the new version", async () => {
    const deletedAt = new Date("2026-10-14T12:00:00Z");
    const softDelete = vi.fn(async (_input: SoftDeleteInput) => "deleted" as const);

    const result = await deleteAccount(USER_ID, { users: fakeStore({ softDelete }), now: () => deletedAt, newId: () => OTHER_USER_ID });

    expect(result).toBe("deleted");
    const input = softDelete.mock.calls[0]![0];
    expect(input).toMatchObject({ userId: USER_ID, deletedAt, anonymised: { email: `deleted_${USER_ID}@deleted.invalid` } });
    const event = input.event(8);
    const validate = eventSchema("UserDeletedEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    expect(event).toMatchObject({ id: OTHER_USER_ID, subject: USER_ID, data: { user_id: USER_ID, version: 8, deleted_at: "2026-10-14T12:00:00.000Z" } });
  });
});

describe("purgeDeletedAccounts", () => {
  it("removes the Supabase account and avatar, then marks the user purged", async () => {
    const now = new Date("2026-10-14T12:00:05Z");
    const markAuthDeleted = vi.fn(async () => undefined);
    const identity = fakeIdentity();
    const avatars = fakeAvatars();
    const users = fakeStore({ pendingAuthDeletions: async () => [USER_ID], markAuthDeleted });

    expect(await purgeDeletedAccounts({ users, identity, avatars, now: () => now })).toBe(1);

    expect(identity.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(avatars.remove).toHaveBeenCalledWith(USER_ID);
    expect(markAuthDeleted).toHaveBeenCalledWith(USER_ID, now);
  });

  it("leaves a failing user for the next run and carries on with the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const markAuthDeleted = vi.fn(async () => undefined);
    const identity = fakeIdentity({
      deleteUser: vi.fn(async (userId: string) => {
        if (userId === USER_ID) throw new Error("supabase down");
      }),
    });
    const users = fakeStore({ pendingAuthDeletions: async () => [USER_ID, OTHER_USER_ID], markAuthDeleted });

    expect(await purgeDeletedAccounts({ users, identity, avatars: fakeAvatars(), now: () => new Date() })).toBe(1);

    expect(markAuthDeleted).toHaveBeenCalledTimes(1);
    expect(markAuthDeleted).toHaveBeenCalledWith(OTHER_USER_ID, expect.any(Date));
  });
});

describe("syncConfirmedEmail", () => {
  it("copies a changed email", async () => {
    const syncEmail = vi.fn(async () => "updated" as const);

    const result = await syncConfirmedEmail({ userId: USER_ID, oldEmail: "a@example.com", newEmail: "b@example.com" }, fakeStore({ syncEmail }));

    expect(result).toBe("updated");
    expect(syncEmail).toHaveBeenCalledWith(USER_ID, "b@example.com");
  });

  it.each([
    { name: "an unchanged email (another auth.users update)", oldEmail: "a@example.com", newEmail: "a@example.com" },
    { name: "no email", oldEmail: "a@example.com", newEmail: null },
  ])("ignores $name", async ({ oldEmail, newEmail }) => {
    const syncEmail = vi.fn();

    expect(await syncConfirmedEmail({ userId: USER_ID, oldEmail, newEmail }, fakeStore({ syncEmail }))).toBe("unchanged");
    expect(syncEmail).not.toHaveBeenCalled();
  });
});
