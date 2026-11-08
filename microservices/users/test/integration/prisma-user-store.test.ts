import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaUserStore } from "../../src/adapters/db/prisma-user-store.js";
import { createDatabase, isDatabaseReachable, type Database } from "../../src/adapters/db/prisma.js";
import { deleteAccount } from "../../src/application/delete-account.js";
import { anonymisedProfile } from "../../src/domain/user.js";
import { eventSchema } from "../support/contract.js";
import { startMigratedPostgres } from "../support/postgres.js";

let container: StartedPostgreSqlContainer;
let database: Database;
let users: PrismaUserStore;

beforeAll(async () => {
  container = await startMigratedPostgres();
  database = createDatabase(container.getConnectionUri());
  users = new PrismaUserStore(database);
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

const address = { addressLine1: "Nørregade 12", addressLine2: null, city: "København K", zipCode: "1165", stateProvince: null };

// A fresh user with a unique username and email, so tests do not depend on each other.
async function newUser() {
  const id = randomUUID();
  const suffix = id.slice(0, 8);
  const result = await users.create({ id, username: `user_${suffix}`, email: `${suffix}@example.com` });
  if (result.kind !== "created") throw new Error(`could not create user: ${result.kind}`);
  return result.user;
}

const remove = (userId: string) => deleteAccount(userId, { users, now: () => new Date(), newId: randomUUID });

describe("users database", () => {
  it("is reachable after the migrations ran", async () => {
    expect(await isDatabaseReachable(database)).toBe(true);
  });

  it("rejects a role other than customer or admin (users_role_check)", async () => {
    const user = await newUser();

    await expect(database.user.update({ where: { id: user.id }, data: { role: "seller" } })).rejects.toThrow(/users_role_check/);
  });

  it("rejects a country code that is not ISO alpha-2 (users_country_code_check)", async () => {
    const user = await newUser();

    await expect(database.user.update({ where: { id: user.id }, data: { countryCode: "dk" } })).rejects.toThrow(/users_country_code_check/);
  });
});

describe("PrismaUserStore.create", () => {
  it("creates a customer at version 1", async () => {
    const user = await newUser();

    expect(user).toMatchObject({ role: "customer", version: 1, address: null, deletedAt: null });
  });

  it("returns the existing user for a repeated id", async () => {
    const user = await newUser();

    expect(await users.create({ id: user.id, username: "something_else", email: "else@example.com" })).toEqual({ kind: "exists", user });
  });

  it("tells a taken username from a taken email", async () => {
    const user = await newUser();

    expect((await users.create({ id: randomUUID(), username: user.username, email: "free@example.com" })).kind).toBe("username_taken");
    expect((await users.create({ id: randomUUID(), username: "free_name", email: user.email })).kind).toBe("email_taken");
  });

  it("refuses to create a deleted account again", async () => {
    const user = await newUser();
    await remove(user.id);

    expect((await users.create({ id: user.id, username: "back_again", email: "back@example.com" })).kind).toBe("account_deleted");
  });
});

describe("PrismaUserStore writes", () => {
  it("bumps the version on every change", async () => {
    const user = await newUser();

    const updated = await users.updateProfile(user.id, { firstName: "Mette", countryCode: "DK" });
    const withAddress = await users.setAddress(user.id, address);
    const withAvatar = await users.setAvatarUrl(user.id, (version) => `https://cdn.example.com/a.png?v=${version}`);
    const withoutAddress = await users.removeAddress(user.id);

    expect(updated).toMatchObject({ kind: "updated", user: { firstName: "Mette", countryCode: "DK", version: 2 } });
    expect(withAddress).toMatchObject({ address, version: 3 });
    expect(withAvatar).toMatchObject({ avatarUrl: "https://cdn.example.com/a.png?v=4", version: 4 });
    expect(withoutAddress).toMatchObject({ address: null, version: 5 });
  });

  it("replaces the one saved address", async () => {
    const user = await newUser();

    await users.setAddress(user.id, address);
    const replaced = await users.setAddress(user.id, { ...address, city: "Aarhus C", zipCode: "8000" });

    expect(replaced?.address).toEqual({ ...address, city: "Aarhus C", zipCode: "8000" });
    expect(await database.address.count({ where: { userId: user.id } })).toBe(1);
  });

  it("does not bump the version when there was no address to remove", async () => {
    const user = await newUser();

    expect(await users.removeAddress(user.id)).toMatchObject({ version: 1 });
  });

  it("answers username_taken when renaming to a taken username", async () => {
    const [user, other] = [await newUser(), await newUser()];

    expect(await users.updateProfile(user.id, { username: other.username })).toEqual({ kind: "username_taken" });
  });

  it("syncs a confirmed email once", async () => {
    const [user, other] = [await newUser(), await newUser()];

    expect(await users.syncEmail(user.id, "mette.new@example.com")).toBe("updated");
    expect(await users.syncEmail(user.id, "mette.new@example.com")).toBe("unchanged");
    expect(await users.syncEmail(user.id, other.email)).toBe("email_taken");
    expect(await users.syncEmail(randomUUID(), "nobody@example.com")).toBe("not_found");
    expect((await users.findActive(user.id))?.email).toBe("mette.new@example.com");
  });

  it("never puts a real email back on an account deleted at the same time", async () => {
    const user = await newUser();

    await Promise.all([remove(user.id), users.syncEmail(user.id, `late-${user.id.slice(0, 8)}@example.com`)]);

    expect((await users.find(user.id))?.email).toBe(`deleted_${user.id}@deleted.invalid`);
  });

  it("refuses every write to a deleted user", async () => {
    const user = await newUser();
    await remove(user.id);

    expect(await users.updateProfile(user.id, { firstName: "Mette" })).toEqual({ kind: "not_found" });
    expect(await users.setAddress(user.id, address)).toBeNull();
    expect(await users.removeAddress(user.id)).toBeNull();
    expect(await users.setAvatarUrl(user.id, () => "https://cdn.example.com/a.png")).toBeNull();
    expect(await users.syncEmail(user.id, "late@example.com")).toBe("not_found");
    expect(await users.findActive(user.id)).toBeNull();
  });
});

describe("PrismaUserStore.softDelete", () => {
  it("anonymises the user, removes the address and writes user_deleted with the new version, in one go", async () => {
    const user = await newUser();
    await users.setAddress(user.id, address);

    expect(await remove(user.id)).toBe("deleted");

    const deleted = await users.find(user.id);
    expect(deleted).toMatchObject({ ...anonymisedProfile(user.id), address: null, version: 3, deletedAt: expect.any(Date) });
    const [outbox] = await database.outboxEvent.findMany({ where: { payload: { path: ["subject"], equals: user.id } } });
    const validate = eventSchema("UserDeletedEvent");
    expect(validate(outbox!.payload), JSON.stringify(validate.errors)).toBe(true);
    expect(outbox).toMatchObject({ type: "user_deleted", publishedAt: null, payload: { data: { user_id: user.id, version: 3 } } });
  });

  it("writes one event when deleted twice at the same time", async () => {
    const user = await newUser();

    const results = await Promise.all([remove(user.id), remove(user.id)]);

    expect(results.sort()).toEqual(["already_deleted", "deleted"]);
    expect(await database.outboxEvent.count({ where: { payload: { path: ["subject"], equals: user.id } } })).toBe(1);
  });

  it("answers not_found for an unknown user", async () => {
    expect(await remove(randomUUID())).toBe("not_found");
  });

  it("lists the deleted users to purge until they are marked", async () => {
    const user = await newUser();
    await remove(user.id);

    expect(await users.pendingAuthDeletions(1000)).toContain(user.id);
    await users.markAuthDeleted(user.id, new Date());
    expect(await users.pendingAuthDeletions(1000)).not.toContain(user.id);
  });
});
