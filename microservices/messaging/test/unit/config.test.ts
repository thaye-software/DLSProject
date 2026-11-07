import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const validEnv = {
  PORT: "3004",
  MONGODB_URL: "mongodb://localhost:27019/messaging",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  CATALOG_URL: "http://localhost:3002",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SECRET_KEY: "service-role-key",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3004,
      mongodbUrl: "mongodb://localhost:27019/messaging",
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
      catalogUrl: "http://localhost:3002",
      supabaseUrl: "http://localhost:54321",
      supabaseSecretKey: "service-role-key",
    });
  });

  it("defaults PORT to 3004", () => {
    expect(loadConfig(envWith({ PORT: undefined })).port).toBe(3004);
  });

  it.each([undefined, ""])("runs without Realtime when SUPABASE_URL is %j", (value) => {
    expect(loadConfig(envWith({ SUPABASE_URL: value })).supabaseUrl).toBeNull();
  });

  it.each([
    { name: "PORT 0", variable: "PORT", value: "0" },
    { name: "MONGODB_URL missing", variable: "MONGODB_URL", value: undefined },
    { name: "MONGODB_URL not mongodb", variable: "MONGODB_URL", value: "postgresql://localhost/messaging" },
    { name: "RABBITMQ_URL http scheme", variable: "RABBITMQ_URL", value: "http://rabbitmq:15672" },
    { name: "CATALOG_URL missing", variable: "CATALOG_URL", value: undefined },
  ])("rejects $name and names the variable", ({ variable, value }) => {
    expect(() => loadConfig(envWith({ [variable]: value }))).toThrow(new RegExp(variable));
  });
});
