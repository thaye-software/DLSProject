import { z } from "zod";

export type Config = {
  port: number;
  databaseUrl: string;
  rabbitmqUrl: string;
  internalJwtSecret: string;
};

const DEFAULT_PORT = 3002;
const MIN_HS256_SECRET_LENGTH = 32;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  INTERNAL_JWT_SECRET: z.string().min(MIN_HS256_SECRET_LENGTH),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    rabbitmqUrl: parsed.data.RABBITMQ_URL,
    internalJwtSecret: parsed.data.INTERNAL_JWT_SECRET,
  };
}
