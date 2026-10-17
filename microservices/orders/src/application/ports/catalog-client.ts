import type { ItemQuantity, OrderLine } from "../../domain/order.js";

export type ReservationRequest = {
  orderId: string;
  items: ItemQuantity[];
  expiresAt: Date;
};

export type ReservationResult =
  | { kind: "reserved"; lines: OrderLine[] }
  | { kind: "unavailable"; productIds: string[] };

export type CatalogClient = {
  // Idempotent per order id: reserving the same order twice returns the same reservation.
  reserve(request: ReservationRequest): Promise<ReservationResult>;
  // Idempotent: releasing an already released reservation succeeds.
  release(orderId: string): Promise<void>;
};
