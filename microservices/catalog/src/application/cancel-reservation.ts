import type { Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import type { CancelDecision, CancelResult } from "./ports/reservation-store.js";
import { returnReservedQuantities } from "./release-reservation.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// A customer cancel is still active. An admin cancel of a paid order is already confirmed. Both put the stored quantities back once.
export async function cancelReservation(
  orderId: string,
  eventId: string,
  { store, now, newId }: ReserveStockDependencies,
): Promise<CancelResult> {
  const at = now();
  return store.cancel(orderId, { id: eventId, type: "order_cancelled" }, (snapshot) =>
    planCancel(snapshot.reservations, snapshot.products, orderId, eventId, at, newId),
  );
}

export function planCancel(
  reservations: readonly Reservation[],
  products: readonly Product[],
  orderId: string,
  eventId: string,
  now: Date,
  newId: () => string,
): CancelDecision {
  const existing = reservations.find((reservation) => reservation.orderId === orderId) ?? null;
  if (!existing) return { kind: "unchanged", outcome: "unknown" };
  if (existing.status === "released") return { kind: "unchanged", outcome: "already_released", reservation: existing };
  return returnReservedQuantities(existing, reservations, products, now, newId, eventId);
}
