"use server";

import { z } from "zod"

import { contactFormSchema } from "@/components/Contact/ContactForm";

// Delivered through the gateway /contact endpoint in Task 9.
export async function sendEmail(_data: z.infer<typeof contactFormSchema>) {
  return false;
}
