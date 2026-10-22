import { availabilityEvent, type AvailabilityEvent } from "../domain/availability-event.js";
import type { Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import { copyHeldProduct, productIsHeld } from "./held-product.js";
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
  const found = findOpenReservation(reservations, orderId);
  if (found.kind === "unchanged") return found;
  if (found.reservation.status === "confirmed") return { kind: "unchanged", outcome: "confirmed", reservation: found.reservation };
  return returnReservedQuantities(found.reservation, reservations, products, now, newId, causationId);
}

// Unknown and already released are shared. planRelease then refuses a confirmed reservation; planCancel does not.
export function findOpenReservation(
  reservations: readonly Reservation[],
  orderId: string,
): { kind: "unchanged"; outcome: "unknown" } | { kind: "unchanged"; outcome: "already_released"; reservation: Reservation } | { kind: "open"; reservation: Reservation } {
  const existing = reservations.find((reservation) => reservation.orderId === orderId) ?? null;
  if (!existing) return { kind: "unchanged", outcome: "unknown" };
  if (existing.status === "released") return { kind: "unchanged", outcome: "already_released", reservation: existing };
  return { kind: "open", reservation: existing };
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
    const next = copyHeldProduct(product, stock, productIsHeld(reservations, productId, existing.orderId));
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

