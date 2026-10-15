import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const validEnv = {
  PORT: "3007",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  MAILER: "resend",
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "onboarding@resend.dev",
};

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...validEnv, ...overrides };
}

describe("loadConfig", () => {
  it("returns typed config when every variable is valid", () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 3007,
      rabbitmqUrl: "amqp://guest:guest@localhost:5672",
      mailer: { kind: "resend", apiKey: "re_test_key", fromEmail: "onboarding@resend.dev" },
    });
  });

  describe("PORT", () => {
    it.each([
      { name: "unset defaults to 3007 (EP)", value: undefined, port: 3007 },
      { name: "boundary 1 (BV)", value: "1", port: 1 },
      { name: "valid range (EP)", value: "8080", port: 8080 },
      { name: "boundary 65535 (BV)", value: "65535", port: 65535 },
    ])("$name", ({ value, port }) => {
      expect(loadConfig(envWith({ PORT: value })).port).toBe(port);
    });

    it.each([
      { name: "boundary 1 − 1 (BV)", value: "0" },
      { name: "boundary 65535 + 1 (BV)", value: "65536" },
      { name: "not a number (EP)", value: "abc" },
      { name: "not an integer (EP)", value: "3007.5" },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ PORT: value }))).toThrow(/PORT/);
    });
  });

  describe("RABBITMQ_URL", () => {
    it.each([
      { name: "amqp scheme (EP)", value: "amqp://rabbitmq:5672" },
      { name: "amqps scheme (EP)", value: "amqps://user:pass@broker.example.com:5671/vhost" },
    ])("$name is accepted", ({ value }) => {
      expect(loadConfig(envWith({ RABBITMQ_URL: value })).rabbitmqUrl).toBe(value);
    });

    it.each([
      { name: "missing (EP)", value: undefined },
      { name: "empty (EP)", value: "" },
      { name: "http scheme (EP)", value: "http://rabbitmq:15672" },
      { name: "not a URL (EP)", value: "rabbitmq" },
    ])("$name is rejected", ({ value }) => {
      expect(() => loadConfig(envWith({ RABBITMQ_URL: value }))).toThrow(/RABBITMQ_URL/);
    });
  });

  describe("mailer selection", () => {
    it.each([
      {
        name: "R1: MAILER unset, key and sender set → resend",
        env: { MAILER: undefined },
        mailer: { kind: "resend", apiKey: "re_test_key", fromEmail: "onboarding@resend.dev" },
      },
      {
        name: "R2: MAILER=resend, key and sender set → resend",
        env: {},
        mailer: { kind: "resend", apiKey: "re_test_key", fromEmail: "onboarding@resend.dev" },
      },
      {
        name: "R6: MAILER=fake, no key or sender → fake",
        env: { MAILER: "fake", RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: undefined },
        mailer: { kind: "fake" },
      },
    ])("$name", ({ env, mailer }) => {
      expect(loadConfig(envWith(env)).mailer).toEqual(mailer);
    });

    it.each([
      {
        name: "R3: MAILER=resend, key missing → names RESEND_API_KEY",
        env: { RESEND_API_KEY: undefined },
        variable: /RESEND_API_KEY/,
      },
      {
        name: "R4: MAILER=resend, sender missing → names RESEND_FROM_EMAIL",
        env: { RESEND_FROM_EMAIL: undefined },
        variable: /RESEND_FROM_EMAIL/,
      },
      {
        name: "R5: MAILER=resend, sender not an email → names RESEND_FROM_EMAIL",
        env: { RESEND_FROM_EMAIL: "onboarding" },
        variable: /RESEND_FROM_EMAIL/,
      },
      {
        name: "R7: MAILER unknown → names MAILER",
        env: { MAILER: "smtp" },
        variable: /MAILER/,
      },
    ])("$name", ({ env, variable }) => {
      expect(() => loadConfig(envWith(env))).toThrow(variable);
    });
  });

  it("names every invalid variable in one error", () => {
    const env = envWith({ RABBITMQ_URL: undefined, RESEND_API_KEY: undefined, PORT: "0" });

    expect(() => loadConfig(env)).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/(?=.*RABBITMQ_URL)(?=.*RESEND_API_KEY)(?=.*PORT)/s),
      }),
    );
  });
});
