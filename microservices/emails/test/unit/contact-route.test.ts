import { describe, expect, it, vi } from "vitest";
import { serve } from "../support/serve.js";

const validBody = {
  name: "Mette Jensen",
  email: "mette@example.com",
  message: "Is the Submariner still available?",
};

async function postContact(
  body: string,
  sendContactMessage = vi.fn(async () => undefined),
  contentType = "application/json",
): Promise<{ response: Response; sendContactMessage: typeof sendContactMessage }> {
  const baseUrl = await serve({ sendContactMessage });
  const response = await fetch(`${baseUrl}/contact`, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
  return { response, sendContactMessage };
}

describe("POST /contact", () => {
  it("answers 202 and sends the message once", async () => {
    const { response, sendContactMessage } = await postContact(JSON.stringify(validBody));

    expect(response.status).toBe(202);
    expect(sendContactMessage).toHaveBeenCalledExactlyOnceWith(validBody);
  });

  it.each([
    { name: "name: one character (BV)", body: { ...validBody, name: "A" } },
    { name: "message: one character (BV)", body: { ...validBody, message: "?" } },
  ])("$name is accepted", async ({ body }) => {
    const { response, sendContactMessage } = await postContact(JSON.stringify(body));

    expect(response.status).toBe(202);
    expect(sendContactMessage).toHaveBeenCalledExactlyOnceWith(body);
  });

  it.each([
    { name: "name: missing (EP)", body: JSON.stringify({ email: validBody.email, message: validBody.message }) },
    { name: "name: empty, boundary 1 − 1 (BV)", body: JSON.stringify({ ...validBody, name: "" }) },
    { name: "name: not a string (EP)", body: JSON.stringify({ ...validBody, name: 42 }) },
    { name: "email: missing (EP)", body: JSON.stringify({ name: validBody.name, message: validBody.message }) },
    { name: "email: not an email (EP)", body: JSON.stringify({ ...validBody, email: "not-an-email" }) },
    { name: "message: missing (EP)", body: JSON.stringify({ name: validBody.name, email: validBody.email }) },
    { name: "message: empty, boundary 1 − 1 (BV)", body: JSON.stringify({ ...validBody, message: "" }) },
    { name: "unknown field (EP)", body: JSON.stringify({ ...validBody, phone: "12345678" }) },
    { name: "body is an array (EP)", body: JSON.stringify([validBody]) },
    { name: "body is not JSON (EP)", body: "name=Mette" },
  ])("$name → 422 problem+json and nothing sent", async ({ body }) => {
    const { response, sendContactMessage } = await postContact(body);

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toMatchObject({
      type: "https://limitedwatches.dk/problems/validation_error",
      title: "Invalid request",
      status: 422,
      instance: "/contact",
    });
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it("answers 422 when the body is not sent as JSON", async () => {
    const { response, sendContactMessage } = await postContact(JSON.stringify(validBody), undefined, "text/plain");

    expect(response.status).toBe(422);
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it("answers 502 problem+json when the email cannot be sent", async () => {
    const failing = vi.fn(async () => Promise.reject(new Error("Resend is down")));

    const { response } = await postContact(JSON.stringify(validBody), failing);

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(await response.json()).toEqual({
      type: "https://limitedwatches.dk/problems/email_unavailable",
      title: "Email provider unavailable",
      status: 502,
      detail: "Email provider unavailable.",
      instance: "/contact",
    });
  });
});
