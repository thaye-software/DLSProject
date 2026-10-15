import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ResendMailer } from "../../src/adapters/resend/resend-mailer.js";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

const testEmail = {
  to: "delivered@resend.dev",
  subject: "Notif integration test",
  html: "<p>Sent by the Notif integration tests.</p>",
};

describe("ResendMailer", () => {
  it.skipIf(!apiKey)("sends to Resend's delivered test inbox", async () => {
    const mailer = new ResendMailer({ apiKey: apiKey!, fromEmail });

    await expect(mailer.send({ ...testEmail, idempotencyKey: randomUUID() })).resolves.toBeUndefined();
  });

  it("throws when Resend rejects the API key", async () => {
    const mailer = new ResendMailer({ apiKey: "re_invalid_key_for_tests", fromEmail });

    await expect(mailer.send(testEmail)).rejects.toThrow(/Resend/);
  });
});
