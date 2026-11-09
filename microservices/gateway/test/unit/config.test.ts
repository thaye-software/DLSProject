import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const validEnv = {
  SUPABASE_URL: "https://x.supabase.co",
};

describe("loadConfig", () => {
  it("loads defaults", () => {
    const config = loadConfig(validEnv);
    expect(config.port).toBe(8000);
    expect(config.upstreams).toEqual({});
    expect(config.supabaseJwtSecret).toBeNull();
    expect(config.upstreamTimeoutMs).toBe(10000);
    expect(config.corsOrigins).toEqual([]);
  });

  it("reads upstreams", () => {
    const config = loadConfig({ ...validEnv, ORDERS_URL: "http://orders:3000" });
    expect(config.upstreams.orders).toBe("http://orders:3000");
    expect(config.upstreams.users).toBeUndefined();
  });

  it("splits CORS_ORIGINS", () => {
    const config = loadConfig({
      ...validEnv,
      CORS_ORIGINS: "http://localhost:3100, https://limitedwatches.dk",
    });
    expect(config.corsOrigins).toEqual(["http://localhost:3100", "https://limitedwatches.dk"]);
  });

  it("strips trailing slashes from SUPABASE_URL", () => {
    expect(loadConfig({ SUPABASE_URL: "https://x.supabase.co/" }).supabaseUrl).toBe("https://x.supabase.co");
  });

  it("rejects a short SUPABASE_JWT_SECRET", () => {
    expect(() => loadConfig({ ...validEnv, SUPABASE_JWT_SECRET: "0123456789" })).toThrow(/Invalid environment/);
  });

  it("treats an empty or blank SUPABASE_JWT_SECRET as absent", () => {
    expect(loadConfig({ ...validEnv, SUPABASE_JWT_SECRET: "" }).supabaseJwtSecret).toBeNull();
    expect(loadConfig({ ...validEnv, SUPABASE_JWT_SECRET: "  " }).supabaseJwtSecret).toBeNull();
  });

  it("rejects a placeholder SUPABASE_JWT_SECRET", () => {
    expect(() => loadConfig({ ...validEnv, SUPABASE_JWT_SECRET: "replace-with-supabase-jwt-secret" })).toThrow(
      /Invalid environment/,
    );
  });

  it("rejects a missing SUPABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment/);
  });
});
