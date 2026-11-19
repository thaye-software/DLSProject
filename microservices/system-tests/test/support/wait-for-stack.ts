import { setTimeout as sleep } from "node:timers/promises";
import { COMPOSE_PROJECT, runningServices, services } from "./stack.js";

const COMPOSE_SERVICES = ["orders", "auth", "catalog", "search", "messaging", "users", "payment", "notif"];
const HEALTH_TIMEOUT_MS = 120_000;
const HEALTH_INTERVAL_MS = 1_000;

export default async function waitForStack(): Promise<void> {
  const running = await runningServices();
  const missing = COMPOSE_SERVICES.filter((service) => !running.includes(service));
  if (missing.length > 0) {
    throw new Error(
      `Not running in compose project ${COMPOSE_PROJECT}: ${missing.join(", ")}. ` +
        "Start the fake-provider stack with `npm run stack:up` (stop your own dev stack first, it uses the same ports).",
    );
  }

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  for (const [name, url] of Object.entries(services)) {
    while (!(await isHealthy(url))) {
      if (Date.now() > deadline) throw new Error(`${name} at ${url}/health did not answer 200 within ${HEALTH_TIMEOUT_MS} ms`);
      await sleep(HEALTH_INTERVAL_MS);
    }
  }
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}/health`)).ok;
  } catch {
    return false;
  }
}
