import type { Money } from "../../domain/money.js";

export type PaymentDetails = {
  order_id: string;
  user_id: string;
  status: string;
  amount_due: Money;
  expires_at: string;
};

export type PaymentDetailsLookup =
  | { kind: "found"; details: PaymentDetails }
  | { kind: "not_found" }
  | { kind: "not_payable" };

export interface OrdersClient {
  getPaymentDetails(orderId: string): Promise<PaymentDetailsLookup>;
}
