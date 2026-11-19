import "server-only";
import { gatewayFetch } from "@/lib/gateway";
import type { Money } from "@/lib/money";

// Typed from docs/contracts/openapi.yaml (PaymentSession)
export type PaymentSession = {
  payment_intent_id: string;
  order_id: string;
  amount: Money;
  client_secret: string;
  expires_at: string;
};

export const createPayment = (orderId: string) =>
  gatewayFetch<PaymentSession>("/payments", { method: "POST", body: { order_id: orderId } });
