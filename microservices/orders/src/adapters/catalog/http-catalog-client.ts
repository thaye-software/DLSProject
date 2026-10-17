import { SignJWT } from "jose";
import { z } from "zod";
import type { CatalogClient, ReservationRequest, ReservationResult } from "../../application/ports/catalog-client.js";

export type HttpCatalogClientOptions = {
  baseUrl: string;
  jwtSecret: string;
};

const SERVICE_NAME = "orders";
const CATALOG_AUDIENCE = "catalog";
const SERVICE_JWT_LIFETIME = "60s";
const REQUEST_TIMEOUT_MS = 5000;

const reservationSchema = z.object({
  order_id: z.uuid(),
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        product_name: z.string(),
        quantity: z.number().int().min(1),
        // Orders only handles DKK; any other currency is a contract violation.
        unit_price: z.object({ amount_minor: z.number().int().min(0), currency: z.literal("DKK") }),
        thumbnail_url: z.url().nullable(),
      }),
    )
    .min(1),
});

const unavailableSchema = z.object({ unavailable_product_ids: z.array(z.uuid()).optional() });

export class HttpCatalogClient implements CatalogClient {
  private readonly baseUrl: URL;
  private readonly jwtKey: Uint8Array;

  constructor({ baseUrl, jwtSecret }: HttpCatalogClientOptions) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    this.jwtKey = new TextEncoder().encode(jwtSecret);
  }

  async reserve({ orderId, items, expiresAt }: ReservationRequest): Promise<ReservationResult> {
    const response = await fetch(new URL("internal/reservations", this.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.serviceJwt()}`,
        "content-type": "application/json",
        accept: "application/json",
        "idempotency-key": orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
        expires_at: expiresAt.toISOString(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 409) {
      const problem = unavailableSchema.safeParse(await response.json().catch(() => ({})));
      const productIds = problem.success ? problem.data.unavailable_product_ids : undefined;
      // Without a list, report every requested product so the customer still learns the order failed.
      return { kind: "unavailable", productIds: productIds ?? items.map((item) => item.productId) };
    }
    if (response.status !== 201 && response.status !== 200) {
      throw new Error(`Catalog answered ${response.status} to the reservation for order ${orderId}`);
    }

    const reservation = reservationSchema.safeParse(await response.json());
    if (!reservation.success) {
      throw new Error(`Catalog sent an invalid reservation for order ${orderId}: ${z.prettifyError(reservation.error)}`);
    }
    if (reservation.data.order_id !== orderId) {
      throw new Error(`Catalog answered the reservation for order ${orderId} with order ${reservation.data.order_id}`);
    }
    return {
      kind: "reserved",
      lines: reservation.data.items.map((line) => ({
        productId: line.product_id,
        productName: line.product_name,
        quantity: line.quantity,
        thumbnailUrl: line.thumbnail_url,
        unitPriceDkk: line.unit_price.amount_minor,
      })),
    };
  }

  async release(orderId: string): Promise<void> {
    const response = await fetch(new URL(`internal/reservations/${encodeURIComponent(orderId)}`, this.baseUrl), {
      method: "DELETE",
      headers: { authorization: `Bearer ${await this.serviceJwt()}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Catalog answered ${response.status} to releasing order ${orderId}`);
  }

  private serviceJwt(): Promise<string> {
    return new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(SERVICE_NAME)
      .setAudience(CATALOG_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(SERVICE_JWT_LIFETIME)
      .sign(this.jwtKey);
  }
}
