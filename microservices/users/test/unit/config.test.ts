import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const SECRET_32_CHARS = "0123456789abcdef0123456789abcdef";

const validEnv = {
  PORT: "3005",
  DATABASE_URL: "postgresql://users:users@localhost:5435/users",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  INTERNAL_JWT_SECRET: SECRET_32_CHARS,
  SUPABASE_WEBHOOK_SECRET: SECRET_32_CHARS,
  SUPABASE_URL: "https://xyz.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3005,
      databaseUrl: "postgresql://users:users@localhost:5435/users",
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
      internalJwtSecret: SECRET_32_CHARS,
      supabaseWebhookSecret: SECRET_32_CHARS,
      identity: { kind: "supabase", url: "https://xyz.supabase.co", serviceRoleKey: "service-role-key", avatarBucket: "avatars" },
    });
  });

  it("defaults PORT to 3005 and AVATAR_BUCKET to avatars", () => {
    const config = loadConfig(envWith({ PORT: undefined }));

    expect(config.port).toBe(3005);
    expect(config.identity).toMatchObject({ avatarBucket: "avatars" });
  });

  it("needs no Supabase settings with IDENTITY_PROVIDER=fake", () => {
    const config = loadConfig(envWith({ IDENTITY_PROVIDER: "fake", SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }));

    expect(config.identity).toEqual({ kind: "fake" });
  });

  it.each([
    { name: "PORT 0", variable: "PORT", value: "0" },
    { name: "DATABASE_URL not postgres", variable: "DATABASE_URL", value: "mysql://localhost/users" },
    { name: "RABBITMQ_URL http scheme", variable: "RABBITMQ_URL", value: "http://rabbitmq:15672" },
    { name: "INTERNAL_JWT_SECRET 31 characters", variable: "INTERNAL_JWT_SECRET", value: SECRET_32_CHARS.slice(1) },
    { name: "SUPABASE_WEBHOOK_SECRET missing", variable: "SUPABASE_WEBHOOK_SECRET", value: undefined },
    { name: "SUPABASE_URL missing", variable: "SUPABASE_URL", value: undefined },
    { name: "SUPABASE_SERVICE_ROLE_KEY missing", variable: "SUPABASE_SERVICE_ROLE_KEY", value: undefined },
    { name: "an unknown IDENTITY_PROVIDER", variable: "IDENTITY_PROVIDER", value: "auth0" },
  ])("rejects $name and names the variable", ({ variable, value }) => {
    expect(() => loadConfig(envWith({ [variable]: value }))).toThrow(new RegExp(variable));
  });
});
