import type { Mailer, OutgoingEmail } from "../application/ports/mailer.js";

export class FakeMailer implements Mailer {
  readonly sent: OutgoingEmail[] = [];

  async send(email: OutgoingEmail): Promise<void> {
    this.sent.push(email);
  }
}
