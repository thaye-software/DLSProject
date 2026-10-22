import type { Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import type { CancelDecision, CancelResult } from "./ports/reservation-store.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";
import { planCancel } from "./cancel-reservation.js";

export const ORDER_STATUSES = [
  "RESERVED",
  "EXPIRED",
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const OUT_WITH_THE_BUYER = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const BACK_ON_THE_SHELF = ["RETURNED", "REFUNDED"] as const;

// Stock comes back on the move into RETURNED or REFUNDED from a status that still had the unit out.
// RETURNED to REFUNDED does not match, so that later event does not add the quantity again.
export async function returnOnStatusChange(
  orderId: string,
  eventId: string,
  previousStatus: OrderStatus,
  status: OrderStatus,
  { store, now, newId }: ReserveStockDependencies,
): Promise<CancelResult> {
  const at = now();
  return store.cancel(orderId, { id: eventId, type: "order_status_changed" }, (snapshot) =>
    planStatusChange(snapshot.reservations, snapshot.products, orderId, eventId, previousStatus, status, at, newId),
  );
}

export function planStatusChange(
  reservations: readonly Reservation[],
  products: readonly Product[],
  orderId: string,
  eventId: string,
  previousStatus: OrderStatus,
  status: OrderStatus,
  now: Date,
  newId: () => string,
): CancelDecision {
  if (!stockComesBack(previousStatus, status)) return { kind: "unchanged", outcome: "not_returning" };
  return planCancel(reservations, products, orderId, eventId, now, newId);
}

function stockComesBack(previousStatus: OrderStatus, status: OrderStatus): boolean {
  return (OUT_WITH_THE_BUYER as readonly OrderStatus[]).includes(previousStatus) && (BACK_ON_THE_SHELF as readonly OrderStatus[]).includes(status);
}
