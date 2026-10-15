import { describe, expect, it, vi } from "vitest";
import { FakePaymentProvider } from "../../src/adapters/fake-payment-provider.js";
import { cancelPayment } from "../../src/application/cancel-payment.js";

const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";

async function providerWithIntent(status?: string) {
  const payments = new FakePaymentProvider();
  if (status) {
    await payments.createIntent({ orderId: ORDER_ID, userId: USER_ID, amount: { amount_minor: 11530000, currency: "DKK" } });
    payments.intents.get(ORDER_ID)!.status = status;
  }
  return payments;
}

describe("cancelPayment", () => {
  it.each([
    { name: "R1: no PaymentIntent for the order", status: undefined, outcome: "no_intent" },
    { name: "R2: PaymentIntent already canceled", status: "canceled", outcome: "already_canceled" },
    { name: "R3: PaymentIntent already succeeded (no cancel, no refund)", status: "succeeded", outcome: "already_paid" },
  ])("$name → $outcome without asking Stripe to cancel", async ({ status, outcome }) => {
    const payments = await providerWithIntent(status);
    const cancelIntent = vi.spyOn(payments, "cancelIntent");

    await expect(cancelPayment(ORDER_ID, { payments })).resolves.toBe(outcome);

    expect(cancelIntent).not.toHaveBeenCalled();
    expect(payments.intents.get(ORDER_ID)?.status).toBe(status);
  });

  it.each([
    { name: "requires_payment_method (customer has not paid yet)", status: "requires_payment_method" },
    { name: "requires_confirmation (EP)", status: "requires_confirmation" },
    { name: "requires_action, e.g. 3-D Secure (EP)", status: "requires_action" },
    { name: "processing (EP)", status: "processing" },
    { name: "requires_capture (EP)", status: "requires_capture" },
  ])("R4: PaymentIntent in $name → cancelled", async ({ status }) => {
    const payments = await providerWithIntent(status);

    await expect(cancelPayment(ORDER_ID, { payments })).resolves.toBe("cancelled");

    expect(payments.intents.get(ORDER_ID)?.status).toBe("canceled");
  });

  it("R5: search is stale and the intent already succeeded, so Stripe refuses to cancel → resolves, so the message is acked", async () => {
    const payments = await providerWithIntent("succeeded");
    const { paymentIntentId } = payments.intents.get(ORDER_ID)!;
    vi.spyOn(payments, "findIntentByOrderId").mockResolvedValue({ id: paymentIntentId, status: "requires_payment_method" });

    await expect(cancelPayment(ORDER_ID, { payments })).resolves.toBe("not_cancellable");

    expect(payments.intents.get(ORDER_ID)?.status).toBe("succeeded");
  });

  it.each([
    { name: "cancelling", fail: (payments: FakePaymentProvider) => vi.spyOn(payments, "cancelIntent").mockRejectedValue(new Error("ECONNRESET")) },
    { name: "searching", fail: (payments: FakePaymentProvider) => vi.spyOn(payments, "findIntentByOrderId").mockRejectedValue(new Error("ECONNRESET")) },
  ])("R6: a network error while $name is thrown, so the message is retried", async ({ fail }) => {
    const payments = await providerWithIntent("requires_payment_method");
    fail(payments);

    await expect(cancelPayment(ORDER_ID, { payments })).rejects.toThrow("ECONNRESET");
  });

  it("handles the same event twice: the second run finds the intent canceled and does nothing", async () => {
    const payments = await providerWithIntent("requires_payment_method");
    const cancelIntent = vi.spyOn(payments, "cancelIntent");

    expect(await cancelPayment(ORDER_ID, { payments })).toBe("cancelled");
    expect(await cancelPayment(ORDER_ID, { payments })).toBe("already_canceled");

    expect(cancelIntent).toHaveBeenCalledOnce();
  });
});
