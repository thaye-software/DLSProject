import { z } from "zod";

export type Config = {
  port: number;
  internalJwtSecret: string;
};

const DEFAULT_PORT = 3002;
const MIN_HS256_SECRET_LENGTH = 32;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  INTERNAL_JWT_SECRET: z.string().min(MIN_HS256_SECRET_LENGTH),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return { port: parsed.data.PORT, internalJwtSecret: parsed.data.INTERNAL_JWT_SECRET };
}
