import { z } from "zod";

export type IdentityConfig =
  | { kind: "supabase"; url: string; serviceRoleKey: string; avatarBucket: string }
  // No Supabase calls: display names and deletions are only logged, avatars get a made-up URL.
  | { kind: "fake" };

export type Config = {
  port: number;
  databaseUrl: string;
  rabbitmqUrl: string;
  internalJwtSecret: string;
  supabaseWebhookSecret: string;
  identity: IdentityConfig;
};

const DEFAULT_PORT = 3005;
const MIN_SECRET_LENGTH = 32;

const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
    INTERNAL_JWT_SECRET: z.string().min(MIN_SECRET_LENGTH),
    SUPABASE_WEBHOOK_SECRET: z.string().min(MIN_SECRET_LENGTH),
    IDENTITY_PROVIDER: z.enum(["supabase", "fake"]).default("supabase"),
    SUPABASE_URL: z.url({ protocol: /^https?$/ }).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    AVATAR_BUCKET: z.string().min(1).default("avatars"),
  })
  .superRefine((env, context) => {
    if (env.IDENTITY_PROVIDER !== "supabase") return;
    for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
      if (!env[name]) context.addIssue({ code: "custom", path: [name], message: "required when IDENTITY_PROVIDER is supabase" });
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
    databaseUrl: data.DATABASE_URL,
    rabbitmqUrl: data.RABBITMQ_URL,
    internalJwtSecret: data.INTERNAL_JWT_SECRET,
    supabaseWebhookSecret: data.SUPABASE_WEBHOOK_SECRET,
    identity:
      data.IDENTITY_PROVIDER === "supabase"
        ? { kind: "supabase", url: data.SUPABASE_URL!, serviceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY!, avatarBucket: data.AVATAR_BUCKET }
        : { kind: "fake" },
  };
}
