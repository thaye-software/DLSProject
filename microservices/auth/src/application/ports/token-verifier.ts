// What a Supabase access token says about its user, once its signature and claims checked out.
export type VerifiedToken = { userId: string; email: string };

export type TokenCheck =
  | { kind: "valid"; token: VerifiedToken }
  // Forged, expired, for another project or not a signed-in user's token: the client's problem (401).
  | { kind: "invalid"; reason: string }
  // Supabase's signing keys could not be fetched: our problem (503), the token may well be fine.
  | { kind: "unavailable" };

export type TokenVerifier = {
  verify(token: string): Promise<TokenCheck>;
};
