import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const services = {
  orders: "http://localhost:3000",
  auth: "http://localhost:3001",
  catalog: "http://localhost:3002",
  search: "http://localhost:3003",
  messaging: "http://localhost:3004",
  users: "http://localhost:3005",
  payment: "http://localhost:3006",
  notif: "http://localhost:3007",
} as const;

export type Service = keyof typeof services;

export const RABBITMQ_URL = "amqp://guest:guest@localhost:5672";

export const COMPOSE_PROJECT = "dls-system-tests";

const SYSTEM_TESTS_DIR = fileURLToPath(new URL("../..", import.meta.url));
const COMPOSE_ARGS = ["compose", "--project-name", COMPOSE_PROJECT, "--profile", "true", "--file", "../docker-compose.yml", "--file", "compose.yml"];
const run = promisify(execFile);

export async function compose(args: string[], env: Record<string, string> = {}): Promise<string> {
  const { stdout } = await run("docker", [...COMPOSE_ARGS, ...args], {
    cwd: SYSTEM_TESTS_DIR,
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

export async function runningServices(): Promise<string[]> {
  const output = await compose(["ps", "--services", "--status", "running"]);
  return output.split(/\s+/).filter(Boolean);
}

export async function serviceLogs(service: string): Promise<string> {
  return compose(["logs", "--no-log-prefix", service]);
}
