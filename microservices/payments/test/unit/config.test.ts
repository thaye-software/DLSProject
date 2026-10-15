import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const JWT_SECRET_32_CHARS = "0123456789abcdef0123456789abcdef";

const validEnv = {
  PORT: "3006",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  ORDERS_URL: "http://orders:3000",
  INTERNAL_JWT_SECRET: JWT_SECRET_32_CHARS,
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_test_51Example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

const stripe = { kind: "stripe", secretKey: "sk_test_51Example", webhookSecret: "whsec_example" };

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3006,
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
      ordersUrl: "http://orders:3000",
      internalJwtSecret: JWT_SECRET_32_CHARS,
      paymentProvider: stripe,
    });
  });

  describe("PORT", () => {
    it.each([
      { name: "unset defaults to 3006 (EP)", value: undefined, port: 3006 },
      { name: "boundary 1 (BV)", value: "1", port: 1 },
      { name: "boundary 65535 (BV)", value: "65535", port: 65535 },
    ])("$name", ({ value, port }) => {
      expect(loadConfig(envWith({ PORT: value })).port).toBe(port);
    });

    it.each([
      { name: "boundary 1 − 1 (BV)", value: "0" },
      { name: "boundary 65535 + 1 (BV)", value: "65536" },
      { name: "not a number (EP)", value: "abc" },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ PORT: value }))).toThrow(/PORT/);
    });
  });

  describe("RABBITMQ_URL", () => {
    it.each([
      { name: "missing (EP)", value: undefined },
      { name: "http scheme (EP)", value: "http://rabbitmq:15672" },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ RABBITMQ_URL: value }))).toThrow(/RABBITMQ_URL/);
    });
  });

  describe("ORDERS_URL", () => {
    it.each([
      { name: "http (EP)", value: "http://orders:3000" },
      { name: "https (EP)", value: "https://orders.internal.example.com" },
    ])("$name is accepted", ({ value }) => {
      expect(loadConfig(envWith({ ORDERS_URL: value })).ordersUrl).toBe(value);
    });

    it.each([
      { name: "missing (EP)", value: undefined },
      { name: "not a URL (EP)", value: "orders" },
      { name: "amqp scheme (EP)", value: "amqp://orders:5672" },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ ORDERS_URL: value }))).toThrow(/ORDERS_URL/);
    });
  });

  describe("INTERNAL_JWT_SECRET", () => {
    it.each([
      { name: "32 characters (BV)", value: JWT_SECRET_32_CHARS },
      { name: "64 characters (EP)", value: JWT_SECRET_32_CHARS.repeat(2) },
    ])("$name is accepted", ({ value }) => {
      expect(loadConfig(envWith({ INTERNAL_JWT_SECRET: value })).internalJwtSecret).toBe(value);
    });

    it.each([
      { name: "missing (EP)", value: undefined },
      { name: "31 characters, boundary 32 − 1 (BV)", value: JWT_SECRET_32_CHARS.slice(1) },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ INTERNAL_JWT_SECRET: value }))).toThrow(/INTERNAL_JWT_SECRET/);
    });

    it("is required even with the fake payment provider", () => {
      const env = envWith({ PAYMENT_PROVIDER: "fake", INTERNAL_JWT_SECRET: undefined });

      expect(() => loadConfig(env)).toThrow(/INTERNAL_JWT_SECRET/);
    });
  });

  describe("payment provider selection", () => {
    it.each([
      { name: "R1: PAYMENT_PROVIDER unset, Stripe keys set → stripe", env: { PAYMENT_PROVIDER: undefined }, provider: stripe },
      { name: "R2: PAYMENT_PROVIDER=stripe, Stripe keys set → stripe", env: {}, provider: stripe },
      {
        name: "R3: restricted Stripe key → stripe",
        env: { STRIPE_SECRET_KEY: "rk_test_51Example" },
        provider: { ...stripe, secretKey: "rk_test_51Example" },
      },
      {
        name: "R8: PAYMENT_PROVIDER=fake, no Stripe keys → fake",
        env: { PAYMENT_PROVIDER: "fake", STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined },
        provider: { kind: "fake" },
      },
    ])("$name", ({ env, provider }) => {
      expect(loadConfig(envWith(env)).paymentProvider).toEqual(provider);
    });

    it.each([
      { name: "R4: secret key missing → names STRIPE_SECRET_KEY", env: { STRIPE_SECRET_KEY: undefined }, variable: /STRIPE_SECRET_KEY/ },
      { name: "R5: publishable key instead of secret key → names STRIPE_SECRET_KEY", env: { STRIPE_SECRET_KEY: "pk_test_51Example" }, variable: /STRIPE_SECRET_KEY/ },
      { name: "R6: webhook secret missing → names STRIPE_WEBHOOK_SECRET", env: { STRIPE_WEBHOOK_SECRET: undefined }, variable: /STRIPE_WEBHOOK_SECRET/ },
      { name: "R7: webhook secret without whsec_ → names STRIPE_WEBHOOK_SECRET", env: { STRIPE_WEBHOOK_SECRET: "sk_test_51Example" }, variable: /STRIPE_WEBHOOK_SECRET/ },
      { name: "R9: unknown provider → names PAYMENT_PROVIDER", env: { PAYMENT_PROVIDER: "paypal" }, variable: /PAYMENT_PROVIDER/ },
    ])("$name", ({ env, variable }) => {
      expect(() => loadConfig(envWith(env))).toThrow(variable);
    });
  });

  it("names every invalid variable in one error", () => {
    const env = envWith({ ORDERS_URL: undefined, INTERNAL_JWT_SECRET: undefined, STRIPE_SECRET_KEY: undefined });

    expect(() => loadConfig(env)).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/(?=.*ORDERS_URL)(?=.*INTERNAL_JWT_SECRET)(?=.*STRIPE_SECRET_KEY)/s),
      }),
    );
  });

  it("does not put secret values in the error", () => {
    const env = envWith({ STRIPE_SECRET_KEY: "pk_live_should_not_leak", INTERNAL_JWT_SECRET: "short-secret" });

    expect(() => loadConfig(env)).toThrow(expect.objectContaining({ message: expect.not.stringMatching(/should_not_leak|short-secret/) }));
  });
});
