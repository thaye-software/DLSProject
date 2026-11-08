import { z } from "zod";

export type Config = {
  port: number;
  supabaseUrl: string;
  supabaseJwtSecret: string | undefined;
  usersUrl: string;
  internalJwtSecret: string;
  roleCacheTtlMs: number;
};

const DEFAULT_PORT = 3001;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_ROLE_CACHE_TTL_MS = 30_000;

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  // Legacy projects only; current ones sign with asymmetric keys published as JWKS. Empty means unset.
  SUPABASE_JWT_SECRET: z
    .string()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.string().min(MIN_SECRET_LENGTH).optional()),
  USERS_URL: z.url({ protocol: /^https?$/ }),
  INTERNAL_JWT_SECRET: z.string().min(MIN_SECRET_LENGTH),
  ROLE_CACHE_TTL_MS: z.coerce.number().int().min(0).default(DEFAULT_ROLE_CACHE_TTL_MS),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: parsed.data.PORT,
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseJwtSecret: parsed.data.SUPABASE_JWT_SECRET,
    usersUrl: parsed.data.USERS_URL,
    internalJwtSecret: parsed.data.INTERNAL_JWT_SECRET,
    roleCacheTtlMs: parsed.data.ROLE_CACHE_TTL_MS,
  };
}
