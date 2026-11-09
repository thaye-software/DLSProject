"use server";

import { z } from "zod"

import { contactFormSchema } from "@/components/Contact/ContactForm";
import { gatewayFetch } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";

export type SendEmailResult = { ok: true } | { ok: false; error: string };

// The gateway's ContactMessage has no phone field (strict), so the phone number goes into the message text.
export async function sendEmail(data: z.infer<typeof contactFormSchema>): Promise<SendEmailResult> {
  const phone = data.customerPhoneNumber?.trim();
  const message = phone ? `${data.customerMessage}\n\nPhone: ${phone}` : data.customerMessage;
  try {
    await gatewayFetch("/contact", {
      method: "POST",
      auth: false,
      body: { name: data.customerName, email: data.customerEmail, message },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: problemMessage(e, "Email was unfortunately not sent, please try again later.", "contact failed") };
  }
}
