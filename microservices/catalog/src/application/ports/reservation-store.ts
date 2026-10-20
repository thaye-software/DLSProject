import type { AvailabilityEvent } from "../../domain/availability-event.js";
import type { Product } from "../../domain/product.js";
import type { Reservation } from "../../domain/reservation.js";

export type ReserveLine = {
  productId: string;
  quantity: number;
};

export type ReserveRequest = {
  orderId: string;
  items: ReserveLine[];
  expiresAt: Date;
};

export type ReserveResult =
  | { outcome: "reserved"; reservation: Reservation }
  | { outcome: "replayed"; reservation: Reservation }
  | { outcome: "out_of_stock"; unavailableProductIds: string[] };

export type ReserveDecision =
  | { kind: "replay"; reservation: Reservation }
  | { kind: "reject"; unavailableProductIds: string[] }
  | { kind: "apply"; reservation: Reservation; products: Product[]; events: AvailabilityEvent[] };

export type ReservationSnapshot = {
  reservation: Reservation | null;
  products: readonly Product[];
};

export type ReservationStore = {
  // The decision runs against a copy. Products, the reservation, and outbox rows change together, or not at all.
  reserve(orderId: string, decide: (snapshot: ReservationSnapshot) => ReserveDecision): Promise<ReserveResult>;
  product(productId: string): Promise<Product | null>;
  events(): Promise<readonly AvailabilityEvent[]>;
};
