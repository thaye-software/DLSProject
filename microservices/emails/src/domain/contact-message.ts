import type { Email } from "./email.js";
import { escapeHtml } from "./html.js";

export type ContactMessage = {
  name: string;
  email: string;
  message: string;
};

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
