import type { Mailer } from "../mailer/mailer.js";
import { renderContactMessage } from "./contact-template.js";
import type { ContactMessage } from "./contact-types.js";

export async function sendContactMessage(contactMessage: ContactMessage, mailer: Mailer): Promise<void> {
  await mailer.send(renderContactMessage(contactMessage));
}
