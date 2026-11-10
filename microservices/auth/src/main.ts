import { FakeTokenVerifier } from "./adapters/fake-token-verifier.js";
import { createApp } from "./adapters/http/app.js";
import { SupabaseTokenVerifier } from "./adapters/supabase-token-verifier.js";
import { HttpUsersClient } from "./adapters/users-client.js";
import { CachedUserDirectory } from "./application/cached-user-directory.js";
import type { TokenVerifier } from "./application/ports/token-verifier.js";
import { verifyRequest } from "./application/verify-request.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);

let tokens: TokenVerifier;
if (config.tokens.kind === "supabase") {
  tokens = new SupabaseTokenVerifier({ supabaseUrl: config.tokens.supabaseUrl, jwtSecret: config.tokens.supabaseJwtSecret });
} else {
  console.warn("TOKEN_VERIFIER=fake: bearer tokens are not checked, anyone can sign in as anyone with fake:<user id>");
  tokens = new FakeTokenVerifier();
}
const users = new CachedUserDirectory(new HttpUsersClient({ baseUrl: config.usersUrl, jwtSecret: config.internalJwtSecret }), {
  ttlMs: config.roleCacheTtlMs,
});

const app = createApp({ verifyRequest: (request) => verifyRequest(request, { tokens, users }) });
const server = app.listen(config.port, () => {
  console.log(`auth listening on port ${config.port} (token verifier: ${config.tokens.kind})`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
