"use server";

import { z } from "zod"

import { contactFormSchema } from "@/components/Contact/ContactForm";

import { resend, originEmail } from "@/lib/resend/resend";

// const resend = new Resend(process.env.RESEND_API_KEY!);
// const originEmail = process.env.RESEND_ORIGIN_EMAIL as string;

export async function sendEmail(data: z.infer<typeof contactFormSchema>) {

  const costumerName = data.costumerName;
  const costumerEmail = data.costumerEmail;
  const costumerMessage = data.costumerMessage;

  try {

    await resend.emails.send({
      from: originEmail,
      to: costumerEmail, // TODO change this to point to actual email adress for reciving costumer mails.
      subject: `New message from ${costumerName}`,
      html: `
        <div style="font-family: sans-serif;">
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${costumerName}</p>
        <p><strong>Costumer email:</strong> ${costumerEmail}</p>
        <p><strong>Message:</strong><br/>${costumerMessage}</p>
        </div>
      `,
    });

    return true;

  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}
