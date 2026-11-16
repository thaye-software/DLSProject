import type { UserEvent } from "../../domain/user-event.js";
import type { AnonymisedProfile, ProfileChanges, User, UserAddress } from "../../domain/user.js";

export type NewUser = { id: string; username: string; email: string };

export type CreateUserResult =
  | { kind: "created"; user: User }
  // The same id was created before (a repeated POST /users).
  | { kind: "exists"; user: User }
  | { kind: "account_deleted" }
  | { kind: "username_taken" }
  | { kind: "email_taken" };

export type UpdateProfileResult = { kind: "updated"; user: User } | { kind: "not_found" } | { kind: "username_taken" };

export type SyncEmailResult = "updated" | "unchanged" | "not_found" | "email_taken";

export type SoftDeleteInput = {
  userId: string;
  anonymised: AnonymisedProfile;
  deletedAt: Date;
  // Builds the user_deleted event from the version the deletion gets.
  event: (version: number) => UserEvent<"user_deleted">;
};

export type SoftDeleteResult = "deleted" | "already_deleted" | "not_found";

// The writes that need a user who exists and is not deleted return null (or not_found) otherwise.
// Every write bumps the user's version.
export type UserStore = {
  create(user: NewUser): Promise<CreateUserResult>;
  // A user who is not deleted.
  findActive(userId: string): Promise<User | null>;
  // Any user, deleted ones included.
  find(userId: string): Promise<User | null>;
  isUsernameTaken(username: string): Promise<boolean>;
  updateProfile(userId: string, changes: ProfileChanges): Promise<UpdateProfileResult>;
  setAddress(userId: string, address: UserAddress): Promise<User | null>;
  removeAddress(userId: string): Promise<User | null>;
  // The URL is built from the version the change gets, which busts caches of the previous image.
  setAvatarUrl(userId: string, url: (version: number) => string): Promise<User | null>;
  syncEmail(userId: string, email: string): Promise<SyncEmailResult>;
  // Anonymises the user, removes the address and writes the event to the outbox, in one transaction.
  softDelete(input: SoftDeleteInput): Promise<SoftDeleteResult>;
  // Deleted users whose Supabase account and avatar are not removed yet, oldest first.
  pendingAuthDeletions(limit: number): Promise<string[]>;
  markAuthDeleted(userId: string, at: Date): Promise<void>;
};
