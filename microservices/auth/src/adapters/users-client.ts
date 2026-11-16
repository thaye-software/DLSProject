import { SignJWT } from "jose";
import { z } from "zod";
import type { UserDirectory, UserLookup } from "../application/ports/user-directory.js";

export type HttpUsersClientOptions = {
  baseUrl: string;
  jwtSecret: string;
};

const SERVICE_NAME = "auth";
const USERS_AUDIENCE = "users";
const SERVICE_JWT_LIFETIME = "60s";
// Every gateway request can wait on this, so it is short; a cached user is served when Users is slow.
const REQUEST_TIMEOUT_MS = 2000;

// InternalUser in docs/contracts/openapi.yaml.
const internalUserSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(["customer", "admin"]),
  deleted: z.boolean(),
});

export class HttpUsersClient implements UserDirectory {
  private readonly baseUrl: URL;
  private readonly jwtKey: Uint8Array;

  constructor({ baseUrl, jwtSecret }: HttpUsersClientOptions) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    this.jwtKey = new TextEncoder().encode(jwtSecret);
  }

  async lookup(userId: string): Promise<UserLookup> {
    let response: Response;
    try {
      response = await fetch(new URL(`internal/users/${encodeURIComponent(userId)}`, this.baseUrl), {
        headers: { authorization: `Bearer ${await this.serviceJwt()}`, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error(`Users did not answer the role lookup for ${userId}`, error);
      return { kind: "unavailable" };
    }

    if (response.status === 404) return { kind: "no_profile" };
    if (response.status !== 200) {
      console.error(`Users answered ${response.status} to the role lookup for ${userId}`);
      return { kind: "unavailable" };
    }
    const body = internalUserSchema.safeParse(await response.json().catch(() => null));
    if (!body.success || body.data.user_id !== userId) {
      console.error(`Users answered the role lookup for ${userId} with a body outside the contract`);
      return { kind: "unavailable" };
    }
    return { kind: "found", user: { role: body.data.role, deleted: body.data.deleted } };
  }

  // docs/contracts/README.md §5: the caller signs its own short-lived HS256 token.
  private serviceJwt(): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(SERVICE_NAME)
      .setAudience(USERS_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(SERVICE_JWT_LIFETIME)
      .sign(this.jwtKey);
  }
}
