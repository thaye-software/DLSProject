/** @jest-environment node */
import { sendEmail } from "@/app/contact/actions";
import { gatewayFetch } from "@/lib/gateway";

jest.mock("@/lib/gateway", () => ({ gatewayFetch: jest.fn() }));
jest.mock("@/lib/problemMessage", () => ({
  problemMessage: (e: { detail?: string }, generic: string) => e.detail ?? generic,
}));
jest.mock("@/components/Contact/ContactForm", () => ({ contactFormSchema: {} }));

const data = { customerName: "Ann", customerEmail: "a@b.dk", customerPhoneNumber: "123", customerMessage: "Hello there!" };

test("posts the gateway ContactMessage without auth and folds the phone into the message", async () => {
  expect(await sendEmail(data)).toEqual({ ok: true });
  expect(gatewayFetch).toHaveBeenCalledWith("/contact", {
    method: "POST",
    auth: false,
    body: { name: "Ann", email: "a@b.dk", message: "Hello there!\n\nPhone: 123" },
  });
});

test("returns the problem detail on failure", async () => {
  (gatewayFetch as jest.Mock).mockRejectedValueOnce({ detail: "Invalid request." });
  expect(await sendEmail(data)).toEqual({ ok: false, error: "Invalid request." });
});
