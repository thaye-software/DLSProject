import type { SyncEmailResult, UserStore } from "./ports/user-store.js";

// From the Supabase webhook (an UPDATE on auth.users): record is the row after the update, old_record before.
export type AuthUserUpdate = { userId: string; oldEmail: string | null; newEmail: string | null };

// The monolith's email-confirmed route: Supabase fires on every auth.users update, and only a changed email
// (which Supabase writes once the change is confirmed) is copied.
export function syncConfirmedEmail({ userId, oldEmail, newEmail }: AuthUserUpdate, users: UserStore): Promise<SyncEmailResult> {
  if (!newEmail || newEmail === oldEmail) return Promise.resolve("unchanged");
  return users.syncEmail(userId, newEmail);
}
