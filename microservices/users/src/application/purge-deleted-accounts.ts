import type { AvatarStorage } from "./ports/avatar-storage.js";
import type { IdentityProvider } from "./ports/identity-provider.js";
import type { UserStore } from "./ports/user-store.js";

export type PurgeDependencies = {
  users: UserStore;
  identity: IdentityProvider;
  avatars: AvatarStorage;
  now: () => Date;
  batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 20;

// Removes the Supabase account and avatar of deleted users. Both calls are idempotent, so a user whose purge
// failed halfway (or that two instances purge at once) is simply purged again on the next run.
export async function purgeDeletedAccounts({ users, identity, avatars, now, batchSize = DEFAULT_BATCH_SIZE }: PurgeDependencies): Promise<number> {
  const userIds = await users.pendingAuthDeletions(batchSize);
  let purged = 0;
  for (const userId of userIds) {
    try {
      await identity.deleteUser(userId);
      await avatars.remove(userId);
      await users.markAuthDeleted(userId, now());
      purged += 1;
    } catch (error) {
      console.error(`Could not remove the Supabase account of deleted user ${userId}, retrying later`, error);
    }
  }
  return purged;
}
