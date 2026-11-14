import { Resend } from "resend";
import { callDependency } from "../shared/logger.js";
import type { Mailer, OutgoingEmail } from "./mailer.js";

export type ResendMailerOptions = {
  apiKey: string;
  fromEmail: string;
};

export class ResendMailer implements Mailer {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor({ apiKey, fromEmail }: ResendMailerOptions) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async send({ to, subject, html, idempotencyKey }: OutgoingEmail): Promise<void> {
    await callDependency("Resend send email", { idempotencyKey }, async () => {
      const { error } = await this.resend.emails.send(
        { from: this.fromEmail, to, subject, html },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      if (error) {
        throw new Error(`Resend rejected the email (${error.statusCode ?? "no status"} ${error.name}): ${error.message}`);
      }
    });
  }
}
