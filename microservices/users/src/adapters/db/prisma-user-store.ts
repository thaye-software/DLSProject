import { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateUserResult,
  NewUser,
  SoftDeleteInput,
  SoftDeleteResult,
  SyncEmailResult,
  UpdateProfileResult,
  UserStore,
} from "../../application/ports/user-store.js";
import type { ProfileChanges, Role, User, UserAddress } from "../../domain/user.js";
import type { Database } from "./prisma.js";

const withAddress = { address: true } satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof withAddress }>;

// Postgres unique violation, as reported by Prisma.
const UNIQUE_VIOLATION = "P2002";
// An update's where matched no row.
const RECORD_NOT_FOUND = "P2025";

const isPrismaError = (error: unknown, code: string) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const active = (userId: string) => ({ id: userId, deletedAt: null }) satisfies Prisma.UserWhereUniqueInput;
const nextVersion = { version: { increment: 1 } } satisfies Prisma.UserUpdateInput;

export class PrismaUserStore implements UserStore {
  constructor(private readonly database: Database) {}

  async create({ id, username, email }: NewUser): Promise<CreateUserResult> {
    const existing = await this.find(id);
    if (existing) return existing.deletedAt ? { kind: "account_deleted" } : { kind: "exists", user: existing };

    try {
      const row = await this.database.user.create({ data: { id, username, email }, include: withAddress });
      return { kind: "created", user: toUser(row) };
    } catch (error) {
      if (!isPrismaError(error, UNIQUE_VIOLATION)) throw error;
      // Work out which constraint it was by looking, rather than parsing the driver's error.
      const raced = await this.find(id);
      if (raced) return raced.deletedAt ? { kind: "account_deleted" } : { kind: "exists", user: raced };
      return (await this.isUsernameTaken(username)) ? { kind: "username_taken" } : { kind: "email_taken" };
    }
  }

  async findActive(userId: string): Promise<User | null> {
    const row = await this.database.user.findFirst({ where: { id: userId, deletedAt: null }, include: withAddress });
    return row && toUser(row);
  }

  async find(userId: string): Promise<User | null> {
    const row = await this.database.user.findUnique({ where: { id: userId }, include: withAddress });
    return row && toUser(row);
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    return (await this.database.user.count({ where: { username } })) > 0;
  }

  async updateProfile(userId: string, changes: ProfileChanges): Promise<UpdateProfileResult> {
    try {
      const row = await this.database.user.update({ where: active(userId), data: { ...changes, ...nextVersion }, include: withAddress });
      return { kind: "updated", user: toUser(row) };
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) return { kind: "not_found" };
      if (isPrismaError(error, UNIQUE_VIOLATION)) return { kind: "username_taken" };
      throw error;
    }
  }

  setAddress(userId: string, address: UserAddress): Promise<User | null> {
    return this.writeActive(userId, async (tx) => {
      await tx.address.upsert({ where: { userId }, create: { userId, ...address }, update: address });
      return true;
    });
  }

  removeAddress(userId: string): Promise<User | null> {
    return this.writeActive(userId, async (tx) => (await tx.address.deleteMany({ where: { userId } })).count > 0);
  }

  async setAvatarUrl(userId: string, url: (version: number) => string): Promise<User | null> {
    return this.database.$transaction(async (tx) => {
      const locked = await lockActive(tx, userId);
      if (!locked) return null;
      const version = locked.version + 1;
      return toUser(await tx.user.update({ where: { id: userId }, data: { avatarUrl: url(version), version }, include: withAddress }));
    });
  }

  async syncEmail(userId: string, email: string): Promise<SyncEmailResult> {
    try {
      return await this.database.$transaction(async (tx): Promise<SyncEmailResult> => {
        // Locked, so a deletion committing meanwhile is seen here and its anonymised email is never overwritten.
        if (!(await lockActive(tx, userId))) return "not_found";
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
        if (user.email === email) return "unchanged";
        await tx.user.update({ where: { id: userId }, data: { email, ...nextVersion } });
        return "updated";
      });
    } catch (error) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) return "email_taken";
      throw error;
    }
  }

  softDelete({ userId, anonymised, deletedAt, event }: SoftDeleteInput): Promise<SoftDeleteResult> {
    return this.database.$transaction(async (tx): Promise<SoftDeleteResult> => {
      // The row lock makes a second, concurrent delete wait and then see deleted_at, so only one event is written.
      const [row] = await tx.$queryRaw<{ version: number; deleted_at: Date | null }[]>`
        SELECT version, deleted_at FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      if (!row) return "not_found";
      if (row.deleted_at) return "already_deleted";

      const version = row.version + 1;
      const deleted = event(version);
      await tx.address.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { ...anonymised, deletedAt, version } });
      await tx.outboxEvent.create({ data: { id: deleted.id, type: deleted.type, payload: deleted } });
      return "deleted";
    });
  }

  async pendingAuthDeletions(limit: number): Promise<string[]> {
    const rows = await this.database.user.findMany({
      where: { deletedAt: { not: null }, authDeletedAt: null },
      orderBy: { deletedAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async markAuthDeleted(userId: string, at: Date): Promise<void> {
    await this.database.user.update({ where: { id: userId }, data: { authDeletedAt: at } });
  }

  // Runs `write` for a user who is not deleted, holding the row lock; bumps the version when it changed something.
  private writeActive(userId: string, write: (tx: Prisma.TransactionClient) => Promise<boolean>): Promise<User | null> {
    return this.database.$transaction(async (tx) => {
      if (!(await lockActive(tx, userId))) return null;
      const changed = await write(tx);
      const row = changed
        ? await tx.user.update({ where: { id: userId }, data: nextVersion, include: withAddress })
        : await tx.user.findUniqueOrThrow({ where: { id: userId }, include: withAddress });
      return toUser(row);
    });
  }
}

async function lockActive(tx: Prisma.TransactionClient, userId: string): Promise<{ version: number } | undefined> {
  const [row] = await tx.$queryRaw<{ version: number }[]>`
    SELECT version FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
  return row;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    phone: row.phone,
    countryCode: row.countryCode,
    avatarUrl: row.avatarUrl,
    // users_role_check allows only these two.
    role: row.role as Role,
    address: row.address && {
      addressLine1: row.address.addressLine1,
      addressLine2: row.address.addressLine2,
      city: row.address.city,
      zipCode: row.address.zipCode,
      stateProvince: row.address.stateProvince,
    },
    version: row.version,
    deletedAt: row.deletedAt,
  };
}
