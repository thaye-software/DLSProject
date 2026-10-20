import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const JWT_SECRET_32_CHARS = "0123456789abcdef0123456789abcdef";

const validEnv = {
  DATABASE_URL: "postgresql://catalog:catalog@localhost:5434/catalog",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  INTERNAL_JWT_SECRET: JWT_SECRET_32_CHARS,
};

describe("loadConfig", () => {
  it("defaults PORT to 3002", () => {
    expect(loadConfig(validEnv).port).toBe(3002);
  });

  it("returns the database and broker urls", () => {
    expect(loadConfig({ ...validEnv, PORT: "3002" })).toEqual({
      port: 3002,
      databaseUrl: validEnv.DATABASE_URL,
      rabbitmqUrl: validEnv.RABBITMQ_URL,
      internalJwtSecret: JWT_SECRET_32_CHARS,
    });
  });
});
