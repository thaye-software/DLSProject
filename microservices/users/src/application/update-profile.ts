import type { ProfileChanges } from "../domain/user.js";
import type { IdentityProvider } from "./ports/identity-provider.js";
import type { UpdateProfileResult, UserStore } from "./ports/user-store.js";

export type UpdateProfileDependencies = { users: UserStore; identity: IdentityProvider };

export async function updateProfile(userId: string, changes: ProfileChanges, { users, identity }: UpdateProfileDependencies): Promise<UpdateProfileResult> {
  const result = await users.updateProfile(userId, changes);
  if (result.kind === "updated" && changes.username !== undefined) {
    // Best effort, after the commit: Users' row is the source of truth, display_name only a copy for Supabase.
    try {
      await identity.setDisplayName(userId, result.user.username);
    } catch (error) {
      console.warn(`Could not copy the new username of user ${userId} to Supabase display_name`, error);
    }
  }
  return result;
}
