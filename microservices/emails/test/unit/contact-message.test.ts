import { describe, expect, it } from "vitest";
import { FakeMailer } from "../../src/adapters/fake-mailer.js";
import { sendContactMessage } from "../../src/application/send-contact-message.js";
import { renderContactMessage } from "../../src/domain/contact-message.js";

const contactMessage = {
  name: "Mette Jensen",
  email: "mette@example.com",
  message: "Is the Submariner still available?",
};

describe("renderContactMessage", () => {
  it("addresses the email to the sender with their name in the subject", () => {
    const email = renderContactMessage(contactMessage);

    expect(email.to).toBe("mette@example.com");
    expect(email.subject).toBe("New message from Mette Jensen");
  });

  it("puts the name, email and message into the HTML", () => {
    const { html } = renderContactMessage(contactMessage);

    expect(html).toContain("<h2>New Contact Message</h2>");
    expect(html).toContain("<p><strong>Name:</strong> Mette Jensen</p>");
    expect(html).toContain("<p><strong>Customer email:</strong> mette@example.com</p>");
    expect(html).toContain("<p><strong>Message:</strong><br/>Is the Submariner still available?</p>");
  });

  it("escapes HTML in the message", () => {
    const { html } = renderContactMessage({ ...contactMessage, message: "<script>alert(1)</script>" });

    expect(html).toContain("<br/>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html).not.toContain("<script>");
  });

  it("escapes HTML in the name and email", () => {
    const { html } = renderContactMessage({ ...contactMessage, name: "<b>Mette</b>", email: "o'brien@example.com" });

    expect(html).toContain("<strong>Name:</strong> &lt;b&gt;Mette&lt;/b&gt;</p>");
    expect(html).toContain("<strong>Customer email:</strong> o&#39;brien@example.com</p>");
  });
});

describe("sendContactMessage", () => {
  it("sends exactly one email, to the sender", async () => {
    const mailer = new FakeMailer();

    await sendContactMessage(contactMessage, mailer);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: "mette@example.com", subject: "New message from Mette Jensen" });
  });

  it("fails when the mailer fails", async () => {
    const failingMailer = { send: async () => Promise.reject(new Error("Resend is down")) };

    await expect(sendContactMessage(contactMessage, failingMailer)).rejects.toThrow("Resend is down");
  });
});
