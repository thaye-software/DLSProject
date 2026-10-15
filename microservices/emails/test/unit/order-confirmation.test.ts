import { describe, expect, it } from "vitest";
import { FakeMailer } from "../../src/adapters/fake-mailer.js";
import { sendOrderConfirmation } from "../../src/application/send-order-confirmation.js";
import { renderOrderConfirmation, type OrderConfirmation } from "../../src/domain/order-confirmation.js";
import { orderConfirmedData } from "../fixtures/order-confirmed.js";

function order(overrides: Partial<OrderConfirmation> = {}): OrderConfirmation {
  return { ...orderConfirmedData(), ...overrides };
}

function billingName(first_name: string, middle_name: string | null, last_name: string) {
  return { ...orderConfirmedData().billing_address, first_name, middle_name, last_name };
}

describe("renderOrderConfirmation", () => {
  it("is addressed to the customer with the monolith's subject", () => {
    const email = renderOrderConfirmation(order());

    expect(email.to).toBe("mette@example.com");
    expect(email.subject).toBe("Finite Watches - Order confirmation");
  });

  it.each([
    { name: "no middle name", address: billingName("Mette", null, "Jensen"), greeting: "Mette Jensen" },
    { name: "with middle name", address: billingName("Mette", "Kirstine", "Jensen"), greeting: "Mette Kirstine Jensen" },
  ])("greets the billing name: $name", ({ address, greeting }) => {
    const { html } = renderOrderConfirmation(order({ billing_address: address }));

    expect(html).toContain(`Thank you for your purchase, ${greeting}.</p>`);
  });

  it("shows the order number, product and quantity", () => {
    const { html } = renderOrderConfirmation(order());

    expect(html).toContain(">#f47ac10b-58cc-4372-a567-0e02b2c3d479</p>");
    expect(html).toContain(">Rolex Submariner Date 126610LN</p>");
    expect(html).toContain(">Quantity: 1</p>");
    expect(html).toContain('<img src="https://cdn.example.com/products/126610ln-1.jpg" alt="Rolex Submariner Date 126610LN"');
  });

  it("shows subtotal, shipping and total in kroner", () => {
    const { html } = renderOrderConfirmation(order());

    expect(html).toMatch(/>Subtotal<\/td>\s*<td[^>]*>115\.000,00 kr\.<\/td>/);
    expect(html).toMatch(/>Shipping<\/td>\s*<td[^>]*>300,00 kr\.<\/td>/);
    expect(html).toMatch(/>Total<\/td>\s*<td[^>]*>115\.300,00 kr\.<\/td>/);
  });

  it.each([
    { name: "daytime in Copenhagen (EP)", confirmedAt: "2026-10-14T10:04:10Z", date: "14 October 2026", year: "2026" },
    { name: "last second before Copenhagen midnight, summer time (BV)", confirmedAt: "2026-10-14T21:59:59Z", date: "14 October 2026", year: "2026" },
    { name: "Copenhagen midnight, summer time (BV)", confirmedAt: "2026-10-14T22:00:00Z", date: "15 October 2026", year: "2026" },
    { name: "new year in Copenhagen before UTC, winter time (BV)", confirmedAt: "2026-12-31T23:30:00Z", date: "1 January 2027", year: "2027" },
  ])("dates the order in Copenhagen time: $name", ({ confirmedAt, date, year }) => {
    const { html } = renderOrderConfirmation(order({ confirmed_at: confirmedAt }));

    expect(html).toMatch(new RegExp(`>Order Date</p>\\s*<p[^>]*>${date}</p>`));
    expect(html).toContain(`© ${year} Finite Watches. All rights reserved.`);
  });

  it("leaves out the image when the product has no thumbnail", () => {
    const item = { ...orderConfirmedData().items[0]!, thumbnail_url: null };

    const { html } = renderOrderConfirmation(order({ items: [item] }));

    expect(html).not.toContain("<img");
    expect(html).toContain(">Rolex Submariner Date 126610LN</p>");
  });

  it("shows the first line when the order has several", () => {
    const first = orderConfirmedData().items[0]!;
    const second = { ...first, product_name: "Omega Speedmaster", quantity: 2 };

    const { html } = renderOrderConfirmation(order({ items: [first, second] }));

    expect(html).toContain(">Rolex Submariner Date 126610LN</p>");
    expect(html).not.toContain("Omega Speedmaster");
  });

  it("escapes HTML in values that came from other services", () => {
    const item = {
      ...orderConfirmedData().items[0]!,
      product_name: "<img src=x onerror=alert(1)>",
      thumbnail_url: 'https://cdn.example.com/a.jpg" onerror="alert(1)',
    };

    const { html } = renderOrderConfirmation(
      order({ items: [item], billing_address: billingName("<b>Mette</b>", null, "Jensen") }),
    );

    expect(html).toContain(">&lt;img src=x onerror=alert(1)&gt;</p>");
    expect(html).toContain('src="https://cdn.example.com/a.jpg&quot; onerror=&quot;alert(1)"');
    expect(html).toContain("Thank you for your purchase, &lt;b&gt;Mette&lt;/b&gt; Jensen.");
    expect(html).not.toContain("onerror=alert(1)>");
    expect(html).not.toContain("<b>Mette</b>");
  });
});

describe("sendOrderConfirmation", () => {
  it("sends the rendered email with the event id as idempotency key", async () => {
    const mailer = new FakeMailer();

    await sendOrderConfirmation(order(), "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b", mailer);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      to: "mette@example.com",
      subject: "Finite Watches - Order confirmation",
      idempotencyKey: "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b",
    });
  });

  it("sends a redelivered event with the same idempotency key, so Resend drops the duplicate", async () => {
    const mailer = new FakeMailer();

    await sendOrderConfirmation(order(), "event-1", mailer);
    await sendOrderConfirmation(order(), "event-1", mailer);

    expect(mailer.sent.map((email) => email.idempotencyKey)).toEqual(["event-1", "event-1"]);
  });
});
