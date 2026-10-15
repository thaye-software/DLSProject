import type { Email } from "../../domain/email.js";

export type OutgoingEmail = Email & {
  idempotencyKey?: string;
};

export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}
