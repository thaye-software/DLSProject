import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const require = createRequire(import.meta.url);

// Starts an empty Postgres and applies prisma/migrations, as the container does on start.
// The Prisma CLI is started with node so this works where `npx` is a shell shim.
export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: "pipe",
  });
  return container;
}
