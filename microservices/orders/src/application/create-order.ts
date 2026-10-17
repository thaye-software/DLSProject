import { RESERVATION_TTL_MS, type Address, type ItemQuantity, type Order, type OrderLine } from "../domain/order.js";
import { uuidV5 } from "../domain/uuid-v5.js";
import type { CatalogClient } from "./ports/catalog-client.js";
import type { OrderRepository } from "./ports/order-repository.js";

// Never change: order ids derived from it must stay the same for retried requests.
const ORDER_ID_NAMESPACE = "3c9a7a52-6f1e-4b8e-9d0a-2f6c1b5e8a47";

export type CreateOrderRequest = {
  userId: string;
  customerEmail: string;
  idempotencyKey: string;
  items: ItemQuantity[];
  billingAddress: Address;
  deliveryAddress: Address;
};

export type CreateOrderResult =
  | { outcome: "created"; order: Order }
  | { outcome: "replayed"; order: Order }
  | { outcome: "unavailable"; productIds: string[] };

export type CreateOrderDependencies = {
  catalog: CatalogClient;
  orders: Pick<OrderRepository, "findByIdempotencyKey" | "insert">;
  shippingPriceDkk: number;
  now: () => Date;
};

// The same user and Idempotency-Key always give the same order id, so concurrent retries reserve
// one Catalog reservation (Catalog is idempotent per order id) and only one insert wins.
export function orderIdFor(userId: string, idempotencyKey: string): string {
  return uuidV5(`${userId}/${idempotencyKey}`, ORDER_ID_NAMESPACE);
}

export async function createOrder(
  request: CreateOrderRequest,
  { catalog, orders, shippingPriceDkk, now }: CreateOrderDependencies,
): Promise<CreateOrderResult> {
  const existing = await orders.findByIdempotencyKey(request.userId, request.idempotencyKey);
  if (existing) return { outcome: "replayed", order: existing };

  const id = orderIdFor(request.userId, request.idempotencyKey);
  const createdAt = now();
  const expiresAt = new Date(createdAt.getTime() + RESERVATION_TTL_MS);

  const reservation = await catalog.reserve({ orderId: id, items: request.items, expiresAt });
  if (reservation.kind === "unavailable") return { outcome: "unavailable", productIds: reservation.productIds };

  let order: Order;
  let inserted: Awaited<ReturnType<OrderRepository["insert"]>>;
  try {
    const items = linesInRequestOrder(request.items, reservation.lines);
    const subTotalDkk = items.reduce((sum, line) => sum + line.unitPriceDkk * line.quantity, 0);
    order = {
      id,
      userId: request.userId,
      customerEmail: request.customerEmail,
      status: "RESERVED",
      items,
      subTotalDkk,
      shippingPriceDkk,
      totalPriceDkk: subTotalDkk + shippingPriceDkk,
      billingAddress: request.billingAddress,
      deliveryAddress: request.deliveryAddress,
      createdAt,
      expiresAt,
    };
    inserted = await orders.insert(order, request.idempotencyKey);
  } catch (error) {
    // The stock is held but no order will point at it; hand it back now instead of waiting for Catalog's timeout.
    await catalog.release(id).catch((releaseError) => {
      console.error(`Could not release the reservation for order ${id}`, releaseError);
    });
    throw error;
  }

  if (inserted.kind === "inserted") return { outcome: "created", order };

  // A concurrent request with the same key inserted first; it owns the reservation, so don't release it.
  const winner = await orders.findByIdempotencyKey(request.userId, request.idempotencyKey);
  if (!winner) throw new Error(`Order ${id} was reported as a duplicate but could not be found`);
  return { outcome: "replayed", order: winner };
}

function linesInRequestOrder(requested: ItemQuantity[], reserved: OrderLine[]): OrderLine[] {
  if (reserved.length !== requested.length) {
    throw new Error(`Catalog reserved ${reserved.length} lines for ${requested.length} requested items`);
  }
  return requested.map(({ productId, quantity }) => {
    const line = reserved.find((candidate) => candidate.productId === productId);
    if (!line || line.quantity !== quantity) {
      throw new Error(`Catalog's reservation does not match the request for product ${productId}`);
    }
    return line;
  });
}
