import { z } from "zod";

export type Config = {
  port: number;
  mongodbUrl: string;
  rabbitmqUrl: string;
  catalogUrl: string;
  supabaseUrl: string | null;
  supabaseSecretKey: string | null;
};

const DEFAULT_PORT = 3004;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  MONGODB_URL: z.url({ protocol: /^mongodb(\+srv)?$/ }),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  CATALOG_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse({
    ...env,
    SUPABASE_URL: env.SUPABASE_URL || undefined,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY || undefined,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: parsed.data.PORT,
    mongodbUrl: parsed.data.MONGODB_URL,
    rabbitmqUrl: parsed.data.RABBITMQ_URL,
    catalogUrl: parsed.data.CATALOG_URL,
    supabaseUrl: parsed.data.SUPABASE_URL ?? null,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY ?? null,
  };
}
