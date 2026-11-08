export type Role = "customer" | "admin";

export type DirectoryUser = { role: Role; deleted: boolean };

export type UserLookup =
  | { kind: "found"; user: DirectoryUser }
  // Signed up with Supabase, but POST /users has not created the profile yet.
  | { kind: "no_profile" }
  | { kind: "unavailable" };

// Users' GET /internal/users/{user_id}.
export type UserDirectory = {
  lookup(userId: string): Promise<UserLookup>;
};
