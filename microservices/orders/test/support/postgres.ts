import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

// Starts an empty Postgres and applies prisma/migrations, as the container does on start.
export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: "pipe",
  });
  return container;
}
