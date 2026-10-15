import { renderContactMessage, type ContactMessage } from "../domain/contact-message.js";
import type { Mailer } from "./ports/mailer.js";

export async function sendContactMessage(contactMessage: ContactMessage, mailer: Mailer): Promise<void> {
  await mailer.send(renderContactMessage(contactMessage));
}
