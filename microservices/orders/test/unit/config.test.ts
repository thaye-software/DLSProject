import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const JWT_SECRET_32_CHARS = "0123456789abcdef0123456789abcdef";

const validEnv = {
  PORT: "3000",
  DATABASE_URL: "postgresql://orders:orders@localhost:5433/orders",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  CATALOG_URL: "http://catalog:8080",
  INTERNAL_JWT_SECRET: JWT_SECRET_32_CHARS,
  SHIPPING_PRICE_MINOR: "30000",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3000,
      databaseUrl: "postgresql://orders:orders@localhost:5433/orders",
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
      catalogUrl: "http://catalog:8080",
      internalJwtSecret: JWT_SECRET_32_CHARS,
      shippingPriceMinor: 30000,
    });
  });

  it("defaults PORT to 3000 and SHIPPING_PRICE_MINOR to 30000 (300 DKK)", () => {
    const config = loadConfig(envWith({ PORT: undefined, SHIPPING_PRICE_MINOR: undefined }));

    expect(config.port).toBe(3000);
    expect(config.shippingPriceMinor).toBe(30000);
  });

  it.each([
    { name: "PORT 0", variable: "PORT", value: "0" },
    { name: "PORT 65536", variable: "PORT", value: "65536" },
    { name: "DATABASE_URL missing", variable: "DATABASE_URL", value: undefined },
    { name: "DATABASE_URL not postgres", variable: "DATABASE_URL", value: "mysql://localhost/orders" },
    { name: "RABBITMQ_URL http scheme", variable: "RABBITMQ_URL", value: "http://rabbitmq:15672" },
    { name: "CATALOG_URL missing", variable: "CATALOG_URL", value: undefined },
    { name: "INTERNAL_JWT_SECRET 31 characters", variable: "INTERNAL_JWT_SECRET", value: JWT_SECRET_32_CHARS.slice(1) },
    { name: "SHIPPING_PRICE_MINOR negative", variable: "SHIPPING_PRICE_MINOR", value: "-1" },
    { name: "SHIPPING_PRICE_MINOR fractional", variable: "SHIPPING_PRICE_MINOR", value: "300.5" },
  ])("rejects $name and names the variable", ({ variable, value }) => {
    expect(() => loadConfig(envWith({ [variable]: value }))).toThrow(new RegExp(variable));
  });

  it("accepts the postgres:// scheme as well as postgresql://", () => {
    const url = "postgres://orders:orders@db:5432/orders";

    expect(loadConfig(envWith({ DATABASE_URL: url })).databaseUrl).toBe(url);
  });
});
