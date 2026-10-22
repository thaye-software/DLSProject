import { availabilityEvent, type AvailabilityEvent } from "../domain/availability-event.js";
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
  const needed = quantitiesByProduct(request.items);
  const unavailable = unavailableProductIds(request.items, byId, needed);
  if (unavailable.length > 0) return { kind: "reject", unavailableProductIds: unavailable };

  const reservationId = newId();
  const { changed, events } = holdsAndEvents(byId, needed, request, now, newId);
  return {
    kind: "apply",
    reservation: {
      reservationId,
      orderId: request.orderId,
      status: "active",
      items: linesAtListPrice(request.items, byId),
      expiresAt: new Date(request.expiresAt),
      createdAt: new Date(now),
    },
    products: products.map((product) => changed.get(product.productId) ?? product),
    events,
  };
}

function quantitiesByProduct(items: readonly ReserveLine[]): Map<string, number> {
  const needed = new Map<string, number>();
  for (const line of items) needed.set(line.productId, (needed.get(line.productId) ?? 0) + line.quantity);
  return needed;
}

function cannotHold(product: Product | undefined, neededQuantity: number): boolean {
  return !product || product.availability === "hidden" || product.availability === "sold" || product.stock < neededQuantity;
}

function unavailableProductIds(
  items: readonly ReserveLine[],
  byId: ReadonlyMap<string, Product>,
  needed: ReadonlyMap<string, number>,
): string[] {
  const unavailable: string[] = [];
  for (const line of items) {
    if (unavailable.includes(line.productId)) continue;
    if (cannotHold(byId.get(line.productId), needed.get(line.productId) ?? 0)) unavailable.push(line.productId);
  }
  return unavailable;
}

// The stock check already rejected a missing product. This runs only if that product is gone afterwards.
export function productAfterStockCheck(byId: ReadonlyMap<string, Product>, productId: string): Product {
  const product = byId.get(productId);
  if (!product) throw new Error(`Product ${productId} disappeared after the stock check`);
  return product;
}

function linesAtListPrice(items: readonly ReserveLine[], byId: ReadonlyMap<string, Product>): ReservationLine[] {
  return items.map((line) => {
    const product = productAfterStockCheck(byId, line.productId);
    return {
      productId: line.productId,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: { ...product.price },
      thumbnailUrl: product.thumbnailUrl,
    };
  });
}

function holdProduct(product: Product, quantity: number): Product {
  return { ...product, price: { ...product.price }, stock: product.stock - quantity, version: product.version + 1, availability: "reserved" };
}

function holdsAndEvents(
  byId: ReadonlyMap<string, Product>,
  needed: ReadonlyMap<string, number>,
  request: ReserveRequest,
  now: Date,
  newId: () => string,
): { changed: Map<string, Product>; events: AvailabilityEvent[] } {
  const changed = new Map<string, Product>();
  const events = [...needed].map(([productId, quantity]) => {
    const product = productAfterStockCheck(byId, productId);
    const next = holdProduct(product, quantity);
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
  return { changed, events };
}
