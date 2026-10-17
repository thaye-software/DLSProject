import { z } from "zod";

export type Config = {
  port: number;
  databaseUrl: string;
  rabbitmqUrl: string;
  catalogUrl: string;
  internalJwtSecret: string;
  shippingPriceMinor: number;
};

const DEFAULT_PORT = 3000;
const MIN_HS256_SECRET_LENGTH = 32;
// The monolith's flat shipping price: 300 DKK.
const DEFAULT_SHIPPING_PRICE_MINOR = 30_000;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  CATALOG_URL: z.url({ protocol: /^https?$/ }),
  INTERNAL_JWT_SECRET: z.string().min(MIN_HS256_SECRET_LENGTH),
  SHIPPING_PRICE_MINOR: z.coerce.number().int().min(0).default(DEFAULT_SHIPPING_PRICE_MINOR),
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
    catalogUrl: parsed.data.CATALOG_URL,
    internalJwtSecret: parsed.data.INTERNAL_JWT_SECRET,
    shippingPriceMinor: parsed.data.SHIPPING_PRICE_MINOR,
  };
}
