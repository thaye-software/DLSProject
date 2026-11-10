// Cuts one service's operations out of docs/contracts/openapi.yaml (as JSON) for a ZAP API scan.
//
//   node service-spec.js <openapi.json> <tag> <server-url> <out.json>
//
// Keeps the operations tagged <tag>, points `servers` at <server-url> (the auth proxy), and fills
// order_id / product_id / user_id with records that exist in the CI stack, so ZAP reaches the handlers
// instead of only their 404s. Env: ORDER_ID, PRODUCT_ID, ZAP_USER_ID (any may be empty).
import { readFileSync, writeFileSync } from "node:fs";

const [input, tag, serverUrl, output] = process.argv.slice(2);
if (!input || !tag || !serverUrl || !output) {
  console.error("usage: node service-spec.js <openapi.json> <tag> <server-url> <out.json>");
  process.exit(2);
}

const METHODS = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const knownIds = Object.fromEntries(
  Object.entries({ order_id: process.env.ORDER_ID, product_id: process.env.PRODUCT_ID, user_id: process.env.ZAP_USER_ID }).filter(
    ([, id]) => id,
  ),
);

const spec = JSON.parse(readFileSync(input, "utf8"));

const paths = {};
let operations = 0;
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  // Path and operation level `servers` override the top-level one, and the contract's point at the public
  // gateway (https://api.limitedwatches.dk) and compose hostnames. Dropping them leaves <server-url> as the
  // only place ZAP can send requests.
  const kept = Object.entries(item)
    .filter(([key, value]) => key !== "servers" && (!METHODS.has(key) || value?.tags?.includes(tag)))
    .map(([key, value]) => {
      if (!METHODS.has(key)) return [key, value];
      const { servers: _servers, ...operation } = value;
      return [key, operation];
    });
  const keptOperations = kept.filter(([key]) => METHODS.has(key)).length;
  if (keptOperations === 0) continue;
  paths[path] = Object.fromEntries(kept);
  operations += keptOperations;
}
if (operations === 0) {
  console.error(`No operations tagged ${tag} in ${input}`);
  process.exit(1);
}

// Parameters named order_id/product_id get an example, and so do those fields inside request body examples.
function useKnownIds(node, insideExample = false) {
  if (Array.isArray(node)) return node.forEach((child) => useKnownIds(child, insideExample));
  if (!node || typeof node !== "object") return;

  if (typeof node.name === "string" && typeof node.in === "string" && node.name in knownIds) {
    node.example = knownIds[node.name];
    delete node.examples;
  }
  for (const [key, value] of Object.entries(node)) {
    if (insideExample && key in knownIds && typeof value === "string") node[key] = knownIds[key];
    else useKnownIds(value, insideExample || key === "example");
  }
}
useKnownIds(paths);

writeFileSync(output, JSON.stringify({ ...spec, servers: [{ url: serverUrl }], paths }, null, 2));
console.log(`${tag}: ${operations} operation(s) -> ${output} (server ${serverUrl})`);
