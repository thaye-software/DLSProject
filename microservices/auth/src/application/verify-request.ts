import type { TokenVerifier } from "./ports/token-verifier.js";
import type { Role, UserDirectory } from "./ports/user-directory.js";

// What the gateway forwards from the client's request.
export type GatewayRequest = {
  authorization: string | undefined;
  // The original request's method and URI (X-Forwarded-Method, X-Forwarded-Uri).
  method: string | undefined;
  uri: string | undefined;
};

export type VerifyResult =
  | { kind: "allowed"; userId: string; email: string; role: Role }
  | { kind: "unauthorized"; detail: string }
  | { kind: "account_deleted" }
  | { kind: "profile_required" }
  | { kind: "signing_keys_unavailable" }
  | { kind: "users_unavailable" };

export type VerifyDependencies = { tokens: TokenVerifier; users: UserDirectory };

const BEARER = /^Bearer\s+(\S+)$/i;

export async function verifyRequest(request: GatewayRequest, { tokens, users }: VerifyDependencies): Promise<VerifyResult> {
  const token = BEARER.exec(request.authorization ?? "")?.[1];
  if (!token) return { kind: "unauthorized", detail: "no bearer token" };

  const check = await tokens.verify(token);
  if (check.kind === "invalid") return { kind: "unauthorized", detail: check.reason };
  if (check.kind === "unavailable") return { kind: "signing_keys_unavailable" };
  const { userId, email } = check.token;

  const lookup = await users.lookup(userId);
  switch (lookup.kind) {
    case "found":
      if (lookup.user.deleted) return { kind: "account_deleted" };
      return { kind: "allowed", userId, email, role: lookup.user.role };
    case "no_profile":
      // The one call a user without a profile can make: creating it. Users then sets role customer.
      return isCreateProfile(request) ? { kind: "allowed", userId, email, role: "customer" } : { kind: "profile_required" };
    case "unavailable":
      return { kind: "users_unavailable" };
  }
}

// The original request's path, without query or fragment.
export function pathOf(uri: string | undefined): string {
  return (uri ?? "").split(/[?#]/)[0] ?? "";
}

function isCreateProfile({ method, uri }: GatewayRequest): boolean {
  return method?.toUpperCase() === "POST" && ["/users", "/users/"].includes(pathOf(uri));
}
