// Stands in for the API gateway (and, for internal routes, the calling service) during ZAP API scans.
//
//   node auth-proxy.js <listen-port> <target-url> [<jwt-issuer> <jwt-audience>]
//
// Every request is forwarded to <target-url> with the headers the gateway would add
// (X-User-Id, X-User-Email, X-User-Role). With an issuer and audience it also adds a service JWT,
// signed per request, because the services reject tokens older than 60 s and a scan takes minutes.
//
// Env: ZAP_USER_ID, ZAP_USER_EMAIL, and INTERNAL_JWT_SECRET when signing service JWTs.
// No dependencies, so CI can run it without npm install.
import { createHmac } from "node:crypto";
import { request as httpRequest, createServer } from "node:http";

const [listenPort, targetUrl, issuer, audience] = process.argv.slice(2);
const { ZAP_USER_ID, ZAP_USER_EMAIL, INTERNAL_JWT_SECRET } = process.env;

if (!listenPort || !targetUrl || !ZAP_USER_ID || !ZAP_USER_EMAIL || (issuer && !INTERNAL_JWT_SECRET)) {
  console.error("usage: ZAP_USER_ID=… ZAP_USER_EMAIL=… [INTERNAL_JWT_SECRET=…] node auth-proxy.js <port> <target> [<issuer> <audience>]");
  process.exit(2);
}

const target = new URL(targetUrl);
const SERVICE_JWT_LIFETIME_S = 60;

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function serviceJwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + SERVICE_JWT_LIFETIME_S,
  })}`;
  return `${unsigned}.${createHmac("sha256", INTERNAL_JWT_SECRET).update(unsigned).digest("base64url")}`;
}

createServer((request, response) => {
  const headers = {
    ...request.headers,
    host: target.host,
    "x-user-id": ZAP_USER_ID,
    "x-user-email": ZAP_USER_EMAIL,
    // Admin reaches every handler, including PATCH /orders/{order_id}/status.
    "x-user-role": "admin",
  };
  if (issuer) headers.authorization = `Bearer ${serviceJwt()}`;

  // request.url is passed through untouched, so ZAP's path traversal payloads reach the service as sent.
  const upstream = httpRequest(
    { hostname: target.hostname, port: target.port, path: request.url, method: request.method, headers },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
    response.end(`auth-proxy: ${error.message}`);
  });
  request.pipe(upstream);
}).listen(Number(listenPort), () => {
  console.log(`auth-proxy :${listenPort} -> ${target.origin}${issuer ? ` (service JWT ${issuer} -> ${audience})` : ""}`);
});
