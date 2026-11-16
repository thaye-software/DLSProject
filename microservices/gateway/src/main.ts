import { createTokenVerifier } from "./auth.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const verifyToken = createTokenVerifier({
  supabaseUrl: config.supabaseUrl,
  issuer: config.supabaseJwtIssuer,
  jwtSecret: config.supabaseJwtSecret });

createApp({ config, verifyToken }).listen(config.port, () => {
  console.log(`gateway listening on :${config.port}, upstreams: ${Object.keys(config.upstreams).join(", ")}`);
});
