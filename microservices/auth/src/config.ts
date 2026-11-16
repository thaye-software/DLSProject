import { z } from "zod";

export type TokenVerifierConfig =
  | { kind: "supabase"; supabaseUrl: string; supabaseJwtSecret: string | undefined }
  // No Supabase project: `fake:<user id>[:<email>]` bearer tokens are taken at their word.
  | { kind: "fake" };

export type Config = {
  port: number;
  tokens: TokenVerifierConfig;
  usersUrl: string;
  internalJwtSecret: string;
  roleCacheTtlMs: number;
};

const DEFAULT_PORT = 3001;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_ROLE_CACHE_TTL_MS = 30_000;

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    TOKEN_VERIFIER: z.enum(["supabase", "fake"]).default("supabase"),
    SUPABASE_URL: z.url({ protocol: /^https?$/ }).optional(),
    // Legacy projects only; current ones sign with asymmetric keys published as JWKS. Empty means unset.
    SUPABASE_JWT_SECRET: z
      .string()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.string().min(MIN_SECRET_LENGTH).optional()),
    USERS_URL: z.url({ protocol: /^https?$/ }),
    INTERNAL_JWT_SECRET: z.string().min(MIN_SECRET_LENGTH),
    ROLE_CACHE_TTL_MS: z.coerce.number().int().min(0).default(DEFAULT_ROLE_CACHE_TTL_MS),
  })
  .superRefine((env, context) => {
    if (env.TOKEN_VERIFIER === "supabase" && !env.SUPABASE_URL) {
      context.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "required when TOKEN_VERIFIER is supabase" });
    }
  });

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  const data = parsed.data;
  return {
    port: data.PORT,
    tokens:
      data.TOKEN_VERIFIER === "supabase"
        ? { kind: "supabase", supabaseUrl: data.SUPABASE_URL!, supabaseJwtSecret: data.SUPABASE_JWT_SECRET }
        : { kind: "fake" },
    usersUrl: data.USERS_URL,
    internalJwtSecret: data.INTERNAL_JWT_SECRET,
    roleCacheTtlMs: data.ROLE_CACHE_TTL_MS,
  };
}
