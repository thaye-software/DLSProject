import { availabilityEvent } from "../domain/availability-event.js";
import type { Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import { copyHeldProduct, productIsHeld } from "./held-product.js";
import type { ConfirmDecision, ConfirmResult } from "./ports/reservation-store.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// Payment success closes the hold. Sellable stock was already reduced when the reservation was created.
export async function confirmReservation(
  orderId: string,
  eventId: string,
  { store, now, newId }: ReserveStockDependencies,
): Promise<ConfirmResult> {
  const at = now();
  return store.confirm(orderId, { id: eventId, type: "order_confirmed" }, (snapshot) =>
    planConfirm(snapshot.reservations, snapshot.products, orderId, eventId, at, newId),
  );
}

export function planConfirm(
  reservations: readonly Reservation[],
  products: readonly Product[],
  orderId: string,
  eventId: string,
  now: Date,
  newId: () => string,
): ConfirmDecision {
  const existing = reservations.find((reservation) => reservation.orderId === orderId) ?? null;
  if (!existing) return { kind: "unchanged", outcome: "unknown" };
  if (existing.status === "released") return { kind: "unchanged", outcome: "already_released", reservation: existing };
  if (existing.status === "confirmed") return { kind: "unchanged", outcome: "already_confirmed", reservation: existing };

  const byId = new Map(products.map((product) => [product.productId, product]));
  const changed = new Map<string, Product>();
  const events = productIds(existing).map((productId) => {
    const product = byId.get(productId);
    if (!product) throw new Error(`Product ${productId} disappeared before its reservation could be confirmed`);
    const next = copyHeldProduct(product, product.stock, productIsHeld(reservations, productId, orderId));
    changed.set(productId, next);
    return availabilityEvent({
      id: newId(),
      productId,
      orderId,
      time: now,
      version: next.version,
      availability: next.availability,
      previousAvailability: product.availability,
      stock: next.stock,
      reason: "order_confirmed",
      causationId: eventId,
    });
  });

  return {
    kind: "apply",
    reservation: { ...existing, status: "confirmed" },
    products: products.map((product) => changed.get(product.productId) ?? product),
    events,
  };
}

function productIds(reservation: Reservation): string[] {
  const ids: string[] = [];
  for (const line of reservation.items) {
    if (!ids.includes(line.productId)) ids.push(line.productId);
  }
  return ids;
}
