import { z } from "zod";

export type MailerConfig =
  | { kind: "resend"; apiKey: string; fromEmail: string }
  | { kind: "fake" };

export type Config = {
  port: number;
  rabbitmqUrl: string;
  mailer: MailerConfig;
};

const DEFAULT_PORT = 3007;

const serviceSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  MAILER: z.enum(["resend", "fake"]).default("resend"),
});

const resendSchema = z.object({
  RESEND_API_KEY: z.string("required when MAILER=resend").min(1, "required when MAILER=resend"),
  RESEND_FROM_EMAIL: z.email("must be an email address when MAILER=resend"),
});

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const service = serviceSchema.safeParse(env);
  const usesResend = (env.MAILER ?? "resend") === "resend";
  const resend = usesResend ? resendSchema.safeParse(env) : undefined;

  if (!service.success || (resend && !resend.success)) {
    const issues = [...(service.error?.issues ?? []), ...(resend?.error?.issues ?? [])];
    const problems = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }

  return {
    port: service.data.PORT,
    rabbitmqUrl: service.data.RABBITMQ_URL,
    mailer: resend?.success
      ? { kind: "resend", apiKey: resend.data.RESEND_API_KEY, fromEmail: resend.data.RESEND_FROM_EMAIL }
      : { kind: "fake" },
  };
}
