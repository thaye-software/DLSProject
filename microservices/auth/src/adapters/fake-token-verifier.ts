import { z } from "zod";
import type { TokenCheck, TokenVerifier } from "../application/ports/token-verifier.js";

// For runs without a Supabase project (the local Kubernetes cluster). Nothing is signed: whoever sends
// `fake:<user id>` or `fake:<user id>:<email>` is that user, so this must never face real clients.
// Without an email the user gets <user id>@fake.invalid, which is unique per user like a real one.
const PREFIX = "fake:";
const FAKE_EMAIL_DOMAIN = "fake.invalid";

const userIdSchema = z.uuid();
const emailSchema = z.email();

export class FakeTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<TokenCheck> {
    if (!token.startsWith(PREFIX)) return { kind: "invalid", reason: "expected fake:<user id>[:<email>]" };

    const [userId = "", ...rest] = token.slice(PREFIX.length).split(":");
    if (!userIdSchema.safeParse(userId).success) return { kind: "invalid", reason: "sub is not a user id" };

    const email = rest.length > 0 ? rest.join(":") : `${userId.toLowerCase()}@${FAKE_EMAIL_DOMAIN}`;
    if (!emailSchema.safeParse(email).success) return { kind: "invalid", reason: "token has no email" };

    return { kind: "valid", token: { userId: userId.toLowerCase(), email } };
  }
}
