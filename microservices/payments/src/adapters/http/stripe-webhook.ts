import type { RequestHandler } from "express";
import Stripe from "stripe";
import type { PaymentWebhook } from "../../application/handle-payment-webhook.js";
import type { PaymentProvider } from "../../application/ports/payment-provider.js";
import type { Money } from "../../domain/money.js";
import { orderOwnerFrom } from "../stripe/order-metadata.js";
import { sendProblem } from "./problem.js";

export type StripeWebhookDependencies = {
  webhookSecret: string;
  payments: Pick<PaymentProvider, "latestRefund">;
  handlePaymentWebhook: (webhook: PaymentWebhook) => Promise<void>;
};

export function createStripeWebhookHandler({
  webhookSecret,
  payments,
  handlePaymentWebhook,
}: StripeWebhookDependencies): RequestHandler {
  return async (request, response) => {
    const instance = request.path;

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(request.body, request.get("stripe-signature") ?? "", webhookSecret);
    } catch {
      sendProblem(response, {
        code: "invalid_signature",
        title: "Invalid signature",
        status: 400,
        detail: "Invalid signature.",
        instance,
      });
      return;
    }

    try {
      const webhook = await toPaymentWebhook(event, payments);
      if (webhook) await handlePaymentWebhook(webhook);
    } catch (error) {
      console.error(`Failed to handle Stripe event ${event.id} (${event.type})`, error);
      sendProblem(response, {
        code: "webhook_failed",
        title: "Webhook could not be processed",
        status: 500,
        detail: "The payment event could not be published.",
        instance,
      });
      return;
    }

    response.json({ received: true });
  };
}

async function toPaymentWebhook(
  event: Stripe.Event,
  payments: Pick<PaymentProvider, "latestRefund">,
): Promise<PaymentWebhook | null> {
  const time = new Date(event.created * 1000);

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const owner = orderOwnerFrom(intent.metadata);
      if (!owner) return ignore(event, `PaymentIntent ${intent.id} has no order metadata`);
      return {
        stripeEventId: event.id,
        type: "payment_complete",
        orderId: owner.orderId,
        time,
        data: {
          payment_intent_id: intent.id,
          order_id: owner.orderId,
          user_id: owner.userId,
          amount: money(intent.amount_received, intent.currency),
          paid_at: time.toISOString(),
        },
      };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const owner = orderOwnerFrom(intent.metadata);
      if (!owner) return ignore(event, `PaymentIntent ${intent.id} has no order metadata`);
      return {
        stripeEventId: event.id,
        type: "payment_failed",
        orderId: owner.orderId,
        time,
        data: {
          payment_intent_id: intent.id,
          order_id: owner.orderId,
          user_id: owner.userId,
          amount: money(intent.amount, intent.currency),
          failure_code: intent.last_payment_error?.code ?? null,
          failure_message: intent.last_payment_error?.message ?? null,
          failed_at: time.toISOString(),
        },
      };
    }
    case "charge.refunded": {
      const refund = await payments.latestRefund(event.data.object.id);
      if (!refund) return ignore(event, `charge ${event.data.object.id} is not for an order`);
      return {
        stripeEventId: event.id,
        type: "payment_refunded",
        orderId: refund.orderId,
        time,
        data: {
          payment_intent_id: refund.paymentIntentId,
          order_id: refund.orderId,
          user_id: refund.userId,
          refund_request_id: refund.refundRequestId,
          amount: refund.amount,
          stripe_refund_id: refund.refundId,
          refunded_at: refund.refundedAt.toISOString(),
        },
      };
    }
    default:
      return null;
  }
}

function ignore(event: Stripe.Event, reason: string): null {
  console.warn(`Ignoring Stripe event ${event.id} (${event.type}): ${reason}`);
  return null;
}

function money(amountMinor: number, currency: string): Money {
  return { amount_minor: amountMinor, currency: currency.toUpperCase() };
}
