import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const SECRET_32_CHARS = "0123456789abcdef0123456789abcdef";

const validEnv = {
  PORT: "3001",
  SUPABASE_URL: "https://xyz.supabase.co",
  USERS_URL: "http://users:3005",
  INTERNAL_JWT_SECRET: SECRET_32_CHARS,
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config with the defaults", () => {
    expect(loadConfig(envWith({ PORT: undefined }))).toEqual({
      port: 3001,
      supabaseUrl: "https://xyz.supabase.co",
      supabaseJwtSecret: undefined,
      usersUrl: "http://users:3005",
      internalJwtSecret: SECRET_32_CHARS,
      roleCacheTtlMs: 30_000,
    });
  });

  it("reads the legacy JWT secret and the cache TTL", () => {
    const config = loadConfig(envWith({ SUPABASE_JWT_SECRET: SECRET_32_CHARS, ROLE_CACHE_TTL_MS: "5000" }));

    expect(config).toMatchObject({ supabaseJwtSecret: SECRET_32_CHARS, roleCacheTtlMs: 5000 });
  });

  it("treats an empty SUPABASE_JWT_SECRET as unset", () => {
    expect(loadConfig(envWith({ SUPABASE_JWT_SECRET: "" })).supabaseJwtSecret).toBeUndefined();
  });

  it.each([
    { name: "PORT 0", variable: "PORT", value: "0" },
    { name: "SUPABASE_URL missing", variable: "SUPABASE_URL", value: undefined },
    { name: "SUPABASE_URL not http", variable: "SUPABASE_URL", value: "ftp://xyz.supabase.co" },
    { name: "SUPABASE_JWT_SECRET too short", variable: "SUPABASE_JWT_SECRET", value: "short" },
    { name: "USERS_URL missing", variable: "USERS_URL", value: undefined },
    { name: "INTERNAL_JWT_SECRET 31 characters", variable: "INTERNAL_JWT_SECRET", value: SECRET_32_CHARS.slice(1) },
    { name: "ROLE_CACHE_TTL_MS negative", variable: "ROLE_CACHE_TTL_MS", value: "-1" },
  ])("rejects $name and names the variable", ({ variable, value }) => {
    expect(() => loadConfig(envWith({ [variable]: value }))).toThrow(new RegExp(variable));
  });
});
