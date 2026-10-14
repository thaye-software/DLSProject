"use server";

import { z } from "zod"

import { contactFormSchema } from "@/components/Contact/ContactForm";

import { resend, originEmail } from "@/lib/resend/resend";

// const resend = new Resend(process.env.RESEND_API_KEY!);
// const originEmail = process.env.RESEND_ORIGIN_EMAIL as string;

export async function sendEmail(data: z.infer<typeof contactFormSchema>) {

  const customerName = data.customerName;
  const customerEmail = data.customerEmail;
  const customerMessage = data.customerMessage;

  try {

    await resend.emails.send({
      from: originEmail,
      to: customerEmail, // TODO change this to point to actual email address for receiving customer mails.
      subject: `New message from ${customerName}`,
      html: `
        <div style="font-family: sans-serif;">
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${customerName}</p>
        <p><strong>Customer email:</strong> ${customerEmail}</p>
        <p><strong>Message:</strong><br/>${customerMessage}</p>
        </div>
      `,
    });

    return true;

  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}
