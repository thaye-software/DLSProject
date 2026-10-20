import { availabilityEvent } from "../domain/availability-event.js";
import type { Product } from "../domain/product.js";
import type { Reservation, ReservationLine } from "../domain/reservation.js";
import type { ReserveDecision, ReserveRequest, ReserveResult, ReservationStore } from "./ports/reservation-store.js";

export type ReserveStockDependencies = {
  store: ReservationStore;
  now: () => Date;
  newId: () => string;
};

// Every requested line is held, or none are. A repeated order id returns the first reservation.
export async function reserveStock(
  request: ReserveRequest,
  { store, now, newId }: ReserveStockDependencies,
): Promise<ReserveResult> {
  const at = now();
  return store.reserve(request.orderId, (snapshot) => planReservation(snapshot.reservation, snapshot.products, request, at, newId));
}

export function planReservation(
  existing: Reservation | null,
  products: readonly Product[],
  request: ReserveRequest,
  now: Date,
  newId: () => string,
): ReserveDecision {
  if (existing) return { kind: "replay", reservation: existing };

  const byId = new Map(products.map((product) => [product.productId, product]));
  const needed = new Map<string, number>();
  for (const line of request.items) needed.set(line.productId, (needed.get(line.productId) ?? 0) + line.quantity);

  const unavailableProductIds: string[] = [];
  for (const line of request.items) {
    if (unavailableProductIds.includes(line.productId)) continue;
    const product = byId.get(line.productId);
    const neededQuantity = needed.get(line.productId) ?? 0;
    if (!product || product.availability === "hidden" || product.availability === "sold" || product.stock < neededQuantity) {
      unavailableProductIds.push(line.productId);
    }
  }
  if (unavailableProductIds.length > 0) return { kind: "reject", unavailableProductIds };

  const items: ReservationLine[] = request.items.map((line) => {
    const product = byId.get(line.productId);
    if (!product) throw new Error(`Product ${line.productId} disappeared after the stock check`);
    return {
      productId: line.productId,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: { ...product.price },
      thumbnailUrl: product.thumbnailUrl,
    };
  });

  const reservationId = newId();
  const changed = new Map<string, Product>();
  const events = [...needed].map(([productId, quantity]) => {
    const product = byId.get(productId);
    if (!product) throw new Error(`Product ${productId} disappeared after the stock check`);
    const next: Product = { ...product, price: { ...product.price }, stock: product.stock - quantity, version: product.version + 1, availability: "reserved" };
    changed.set(productId, next);
    return availabilityEvent({
      id: newId(),
      productId,
      orderId: request.orderId,
      time: now,
      version: next.version,
      availability: next.availability,
      previousAvailability: product.availability,
      stock: next.stock,
      reason: "order_reserved",
      causationId: null,
    });
  });

  return {
    kind: "apply",
    reservation: {
      reservationId,
      orderId: request.orderId,
      status: "active",
      items,
      expiresAt: new Date(request.expiresAt),
      createdAt: new Date(now),
    },
    products: products.map((product) => changed.get(product.productId) ?? product),
    events,
  };
}
