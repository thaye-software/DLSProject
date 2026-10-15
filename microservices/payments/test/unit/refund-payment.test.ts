import { describe, expect, it, vi } from "vitest";
import { FakePaymentProvider } from "../../src/adapters/fake-payment-provider.js";
import { refundPayment } from "../../src/application/refund-payment.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
const REFUND_REQUEST_ID = "d4c3b2a1-0f9e-4d8c-b7a6-5f4e3d2c1b0a";
const PAID = { amount_minor: 11530000, currency: "DKK" };
const PAYMENT_INTENT_ID = `pi_fake_${ORDER_ID.replaceAll("-", "")}`;

async function providerWithIntent(status?: string) {
  const payments = new FakePaymentProvider();
  if (status) {
    await payments.createIntent({ orderId: ORDER_ID, userId: USER_ID, amount: PAID });
    payments.intents.get(ORDER_ID)!.status = status;
  }
  return payments;
}

function request(amount = PAID) {
  return { refundRequestId: REFUND_REQUEST_ID, orderId: ORDER_ID, amount };
}

describe("refundPayment", () => {
  it("R1: refunds a succeeded PaymentIntent by the requested amount, keyed by the refund request id", async () => {
    const payments = await providerWithIntent("succeeded");
    const refund = vi.spyOn(payments, "refund");
    const partOfThePayment = { amount_minor: 30000, currency: "DKK" };

    await refundPayment(request(partOfThePayment), { payments });

    expect(refund).toHaveBeenCalledExactlyOnceWith({
      paymentIntentId: PAYMENT_INTENT_ID,
      amount: partOfThePayment,
      refundRequestId: REFUND_REQUEST_ID,
    });
    expect([...payments.refunds.values()]).toEqual([
      { refundId: expect.stringMatching(/^re_/), paymentIntentId: PAYMENT_INTENT_ID, amount: partOfThePayment },
    ]);
  });

  it("R2: the same refund request twice reuses the idempotency key, so only one refund exists", async () => {
    const payments = await providerWithIntent("succeeded");
    const refund = vi.spyOn(payments, "refund");

    const first = await refundPayment(request(), { payments });
    const second = await refundPayment(request(), { payments });

    expect(refund).toHaveBeenCalledTimes(2);
    expect(refund.mock.calls.map(([call]) => call.refundRequestId)).toEqual([REFUND_REQUEST_ID, REFUND_REQUEST_ID]);
    expect(second).toEqual(first);
    expect(payments.refunds.size).toBe(1);
  });

  it.each([
    { name: "R3: no PaymentIntent for the order (or Stripe Search has not caught up)", status: undefined },
    { name: "R4: PaymentIntent still requires_payment_method", status: "requires_payment_method" },
    { name: "R4: PaymentIntent still processing (EP)", status: "processing" },
    { name: "R4: PaymentIntent canceled (EP)", status: "canceled" },
  ])("$name → throws, so the message retries and then goes to the DLQ", async ({ status }) => {
    const payments = await providerWithIntent(status);
    const refund = vi.spyOn(payments, "refund");

    await expect(refundPayment(request(), { payments })).rejects.toThrow(ORDER_ID);

    expect(refund).not.toHaveBeenCalled();
  });

  it("R5: Stripe failing to refund is thrown, so the message retries", async () => {
    const payments = await providerWithIntent("succeeded");
    vi.spyOn(payments, "refund").mockRejectedValue(new Error("ECONNRESET"));

    await expect(refundPayment(request(), { payments })).rejects.toThrow("ECONNRESET");
  });
});
