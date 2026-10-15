import { z } from "zod";

export type PaymentProviderConfig =
  | { kind: "stripe"; secretKey: string; webhookSecret: string }
  | { kind: "fake" };

export type Config = {
  port: number;
  rabbitmqUrl: string;
  ordersUrl: string;
  internalJwtSecret: string;
  paymentProvider: PaymentProviderConfig;
};

const DEFAULT_PORT = 3006;
const MIN_HS256_SECRET_LENGTH = 32;

const serviceSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  ORDERS_URL: z.url({ protocol: /^https?$/ }),
  INTERNAL_JWT_SECRET: z.string().min(MIN_HS256_SECRET_LENGTH),
  PAYMENT_PROVIDER: z.enum(["stripe", "fake"]).default("stripe"),
});

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z
    .string("required when PAYMENT_PROVIDER=stripe")
    .regex(/^(sk|rk)_/, "must be a Stripe secret (sk_) or restricted (rk_) key"),
  STRIPE_WEBHOOK_SECRET: z
    .string("required when PAYMENT_PROVIDER=stripe")
    .startsWith("whsec_", "must be a Stripe webhook signing secret (whsec_)"),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const service = serviceSchema.safeParse(env);
  const usesStripe = (env.PAYMENT_PROVIDER ?? "stripe") === "stripe";
  const stripe = usesStripe ? stripeSchema.safeParse(env) : undefined;

  if (!service.success || (stripe && !stripe.success)) {
    const issues = [...(service.error?.issues ?? []), ...(stripe?.error?.issues ?? [])];
    const problems = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: service.data.PORT,
    rabbitmqUrl: service.data.RABBITMQ_URL,
    ordersUrl: service.data.ORDERS_URL,
    internalJwtSecret: service.data.INTERNAL_JWT_SECRET,
    paymentProvider: stripe?.success
      ? { kind: "stripe", secretKey: stripe.data.STRIPE_SECRET_KEY, webhookSecret: stripe.data.STRIPE_WEBHOOK_SECRET }
      : { kind: "fake" },
  };
}
