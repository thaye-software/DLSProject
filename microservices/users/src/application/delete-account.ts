import { buildUserDeletedEvent } from "../domain/user-event.js";
import { anonymisedProfile } from "../domain/user.js";
import type { SoftDeleteResult, UserStore } from "./ports/user-store.js";

export type DeleteAccountDependencies = { users: UserStore; now: () => Date; newId: () => string };

// The database part of the monolith's softDeleteAccount. The Supabase account and the avatar file are removed
// afterwards by purgeDeletedAccounts, so a failing external call can never leave a half-deleted row behind.
// Favorites and order addresses now live in Catalog and Orders, which clean up on user_deleted.
export function deleteAccount(userId: string, { users, now, newId }: DeleteAccountDependencies): Promise<SoftDeleteResult> {
  const deletedAt = now();
  return users.softDelete({
    userId,
    anonymised: anonymisedProfile(userId),
    deletedAt,
    event: (version) => buildUserDeletedEvent({ id: newId(), userId, version, deletedAt }),
  });
}
