// Supabase Auth, through its admin API. Login, signup and email/password changes do not pass through Users.
export type IdentityProvider = {
  // The monolith kept the username in user_metadata.display_name as well.
  setDisplayName(userId: string, displayName: string): Promise<void>;
  // Resolves when the account is gone, also when it was already gone.
  deleteUser(userId: string): Promise<void>;
};
