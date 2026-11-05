import type { Email } from "../shared/email.js";
import { escapeHtml } from "../shared/html.js";
import type { ContactMessage } from "./contact-types.js";

export function renderContactMessage({ name, email, message }: ContactMessage): Email {
  return {
    to: email,
    subject: `New message from ${name}`,
    html: `
      <div style="font-family: sans-serif;">
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Customer email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message)}</p>
      </div>
    `,
  };
}
