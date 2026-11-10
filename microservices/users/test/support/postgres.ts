import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

// The Prisma CLI run with this Node, rather than through npx: on Windows npx is npx.cmd, which Node only spawns via a shell.
const PRISMA_CLI = fileURLToPath(import.meta.resolve("prisma/build/index.js"));

// Starts an empty Postgres and applies prisma/migrations, as the container does on start.
export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  execFileSync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: "pipe",
  });
  return container;
}
