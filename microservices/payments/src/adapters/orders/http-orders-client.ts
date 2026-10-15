import { SignJWT } from "jose";
import { z } from "zod";
import type { OrdersClient, PaymentDetailsLookup } from "../../application/ports/orders-client.js";

export type HttpOrdersClientOptions = {
  baseUrl: string;
  jwtSecret: string;
};

const SERVICE_NAME = "payment";
const ORDERS_AUDIENCE = "orders";
const SERVICE_JWT_LIFETIME = "60s";
const REQUEST_TIMEOUT_MS = 5000;

const paymentDetailsSchema = z.object({
  order_id: z.uuid(),
  user_id: z.uuid(),
  status: z.string(),
  amount_due: z.object({
    amount_minor: z.number().int().min(0),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  expires_at: z.iso.datetime({ offset: true }),
});

export class HttpOrdersClient implements OrdersClient {
  private readonly baseUrl: URL;
  private readonly jwtKey: Uint8Array;

  constructor({ baseUrl, jwtSecret }: HttpOrdersClientOptions) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    this.jwtKey = new TextEncoder().encode(jwtSecret);
  }

  async getPaymentDetails(orderId: string): Promise<PaymentDetailsLookup> {
    const url = new URL(`internal/orders/${encodeURIComponent(orderId)}/payment-details`, this.baseUrl);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${await this.serviceJwt()}`, accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 409) return { kind: "not_payable" };
    if (!response.ok) {
      throw new Error(`Orders answered ${response.status} to payment details for order ${orderId}`);
    }

    const details = paymentDetailsSchema.safeParse(await response.json());
    if (!details.success) {
      throw new Error(`Orders sent invalid payment details for order ${orderId}: ${z.prettifyError(details.error)}`);
    }
    return { kind: "found", details: details.data };
  }

  private serviceJwt(): Promise<string> {
    return new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(SERVICE_NAME)
      .setAudience(ORDERS_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(SERVICE_JWT_LIFETIME)
      .sign(this.jwtKey);
  }
}
