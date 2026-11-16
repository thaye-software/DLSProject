import { z } from "zod";

export type ServiceName = "orders" | "payment" | "catalog" | "search" | "messaging" | "notif" | "users";

export type Config = {
  port: number;
  supabaseUrl: string;
  supabaseJwtIssuer: string;
  supabaseJwtSecret: string | null;
  upstreams: Partial<Record<ServiceName, string>>;
  corsOrigins: string[];
  upstreamTimeoutMs: number;
};

const DEFAULT_PORT = 8000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const MIN_HS256_SECRET_LENGTH = 32;
const SERVICE_NAMES: ServiceName[] = ["orders", "payment", "catalog", "search", "messaging", "notif", "users"];

const httpUrl = z.url({ protocol: /^https?$/ });

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SUPABASE_URL: httpUrl.transform((url) => url.replace(/\/+$/, "")),
  // Exact `iss` to accept, when the gateway reaches Supabase on another address than the one tokens name
  // (local Supabase in Docker: fetch via host.docker.internal, tokens say 127.0.0.1).
  SUPABASE_JWT_ISSUER: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    httpUrl.transform((url) => url.replace(/\/+$/, "")).optional(),
  ),
  // Blank means absent. Placeholders are rejected: a published secret lets anyone mint admin tokens.
  SUPABASE_JWT_SECRET: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .min(MIN_HS256_SECRET_LENGTH)
      .refine((v) => !v.startsWith("replace-with"), "must not be a placeholder")
      .optional(),
  ),
  ORDERS_URL: httpUrl.optional(),
  PAYMENT_URL: httpUrl.optional(),
  CATALOG_URL: httpUrl.optional(),
  SEARCH_URL: httpUrl.optional(),
  MESSAGING_URL: httpUrl.optional(),
  NOTIF_URL: httpUrl.optional(),
  USERS_URL: httpUrl.optional(),
  CORS_ORIGINS: z.string().default(""),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1).default(DEFAULT_UPSTREAM_TIMEOUT_MS),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  const data = parsed.data;
  const upstreamUrls: Record<ServiceName, string | undefined> = {
    orders: data.ORDERS_URL,
    payment: data.PAYMENT_URL,
    catalog: data.CATALOG_URL,
    search: data.SEARCH_URL,
    messaging: data.MESSAGING_URL,
    notif: data.NOTIF_URL,
    users: data.USERS_URL,
  };
  const upstreams: Config["upstreams"] = {};
  for (const name of SERVICE_NAMES) {
    const url = upstreamUrls[name];
    if (url !== undefined) upstreams[name] = url;
  }

  return {
    port: data.PORT,
    supabaseUrl: data.SUPABASE_URL,
    supabaseJwtIssuer: data.SUPABASE_JWT_ISSUER ?? `${data.SUPABASE_URL}/auth/v1`,
    supabaseJwtSecret: data.SUPABASE_JWT_SECRET ?? null,
    upstreams,
    corsOrigins: data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0),
    upstreamTimeoutMs: data.UPSTREAM_TIMEOUT_MS,
  };
}
