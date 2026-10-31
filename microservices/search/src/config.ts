import { z } from "zod";

export type Config = {
  port: number;
  mongodbUrl: string;
  // Without Redis every search goes to MongoDB.
  redisUrl: string | null;
  rabbitmqUrl: string;
};

const DEFAULT_PORT = 3003;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  MONGODB_URL: z.url({ protocol: /^mongodb(\+srv)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  // An empty REDIS_URL in a .env file means "no cache", not "invalid URL".
  const parsed = schema.safeParse({ ...env, REDIS_URL: env.REDIS_URL || undefined });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: parsed.data.PORT,
    mongodbUrl: parsed.data.MONGODB_URL,
    redisUrl: parsed.data.REDIS_URL ?? null,
    rabbitmqUrl: parsed.data.RABBITMQ_URL,
  };
}
