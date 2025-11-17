import { Resend } from "resend";

function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export const originEmail = process.env.RESEND_ORIGIN_EMAIL as string;
export const resend = createResendClient();