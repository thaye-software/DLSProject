import { availabilityEvent, type AvailabilityEvent } from "../domain/availability-event.js";
import type { Availability, Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import type { ReleaseDecision, ReleaseResult, ReservationStore } from "./ports/reservation-store.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// An active reservation's quantities come back once. Confirmed, released, and unknown orders do not move stock.
export async function releaseReservation(orderId: string, { store, now, newId }: ReserveStockDependencies): Promise<ReleaseResult> {
  const at = now();
  return store.release(orderId, (snapshot) => planRelease(snapshot.reservations, snapshot.products, orderId, at, newId, null));
}

export function planRelease(
  reservations: readonly Reservation[],
  products: readonly Product[],
  orderId: string,
  now: Date,
  newId: () => string,
  causationId: string | null,
): ReleaseDecision {
  const existing = reservations.find((reservation) => reservation.orderId === orderId) ?? null;
  if (!existing) return { kind: "unchanged", outcome: "unknown" };
  if (existing.status === "released") return { kind: "unchanged", outcome: "already_released", reservation: existing };
  if (existing.status === "confirmed") return { kind: "unchanged", outcome: "confirmed", reservation: existing };
  return returnReservedQuantities(existing, reservations, products, now, newId, causationId);
}

// The stored quantities go back once and the reservation becomes released. An order event passes its id; a direct release passes null.
export function returnReservedQuantities(
  existing: Reservation,
  reservations: readonly Reservation[],
  products: readonly Product[],
  now: Date,
  newId: () => string,
  causationId: string | null,
): { kind: "apply"; reservation: Reservation; products: Product[]; events: AvailabilityEvent[] } {
  const byId = new Map(products.map((product) => [product.productId, product]));
  const returning = new Map<string, number>();
  for (const line of existing.items) returning.set(line.productId, (returning.get(line.productId) ?? 0) + line.quantity);

  const changed = new Map<string, Product>();
  const events = [...returning].map(([productId, quantity]) => {
    const product = byId.get(productId);
    if (!product) throw new Error(`Product ${productId} disappeared before its reservation could be released`);
    const stock = product.stock + quantity;
    const next: Product = {
      ...product,
      price: { ...product.price },
      stock,
      version: product.version + 1,
      availability: availabilityAfterRelease(productIsHeld(reservations, productId, existing.orderId), stock),
    };
    changed.set(productId, next);
    return availabilityEvent({
      id: newId(),
      productId,
      orderId: existing.orderId,
      time: now,
      version: next.version,
      availability: next.availability,
      previousAvailability: product.availability,
      stock: next.stock,
      reason: "order_released",
      causationId,
    });
  });

  return {
    kind: "apply",
    reservation: { ...existing, status: "released" },
    products: products.map((product) => changed.get(product.productId) ?? product),
    events,
  };
}

function productIsHeld(reservations: readonly Reservation[], productId: string, exceptOrderId: string): boolean {
  return reservations.some(
    (reservation) =>
      reservation.orderId !== exceptOrderId &&
      reservation.status === "active" &&
      reservation.items.some((line) => line.productId === productId && line.quantity > 0),
  );
}

function availabilityAfterRelease(stillHeld: boolean, stock: number): Availability {
  if (stillHeld) return "reserved";
  if (stock > 0) return "available";
  return "sold";
}
