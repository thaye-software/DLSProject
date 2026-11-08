import { createApp } from "./adapters/http/app.js";
import { SupabaseTokenVerifier } from "./adapters/supabase-token-verifier.js";
import { HttpUsersClient } from "./adapters/users-client.js";
import { CachedUserDirectory } from "./application/cached-user-directory.js";
import { verifyRequest } from "./application/verify-request.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);

const tokens = new SupabaseTokenVerifier({ supabaseUrl: config.supabaseUrl, jwtSecret: config.supabaseJwtSecret });
const users = new CachedUserDirectory(new HttpUsersClient({ baseUrl: config.usersUrl, jwtSecret: config.internalJwtSecret }), {
  ttlMs: config.roleCacheTtlMs,
});

const app = createApp({ verifyRequest: (request) => verifyRequest(request, { tokens, users }) });
const server = app.listen(config.port, () => {
  console.log(`auth listening on port ${config.port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
