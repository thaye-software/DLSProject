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

export type ReleaseResult =
  | { outcome: "released"; reservation: Reservation }
  | { outcome: "already_released"; reservation: Reservation }
  | { outcome: "confirmed"; reservation: Reservation }
  | { outcome: "unknown" };

export type ReleaseDecision =
  | { kind: "unchanged"; outcome: "unknown" }
  | { kind: "unchanged"; outcome: "already_released" | "confirmed"; reservation: Reservation }
  | { kind: "apply"; reservation: Reservation; products: Product[]; events: AvailabilityEvent[] };

export type ConfirmEvent = {
  id: string;
  type: string;
};

export type ConfirmResult =
  | { outcome: "confirmed"; reservation: Reservation }
  | { outcome: "already_released"; reservation: Reservation }
  | { outcome: "already_confirmed"; reservation: Reservation }
  | { outcome: "duplicate" }
  | { outcome: "unknown" };

export type ConfirmDecision =
  | { kind: "unchanged"; outcome: "unknown" }
  | { kind: "unchanged"; outcome: "already_released" | "already_confirmed"; reservation: Reservation }
  | { kind: "apply"; reservation: Reservation; products: Product[]; events: AvailabilityEvent[] };

export type CancelResult =
  | { outcome: "released"; reservation: Reservation }
  | { outcome: "already_released"; reservation: Reservation }
  | { outcome: "duplicate" }
  | { outcome: "unknown" };

export type CancelDecision =
  | { kind: "unchanged"; outcome: "unknown" }
  | { kind: "unchanged"; outcome: "already_released"; reservation: Reservation }
  | { kind: "apply"; reservation: Reservation; products: Product[]; events: AvailabilityEvent[] };

export type ExpireResult =
  | { outcome: "released"; reservation: Reservation }
  | { outcome: "already_released"; reservation: Reservation }
  | { outcome: "confirmed"; reservation: Reservation }
  | { outcome: "duplicate" }
  | { outcome: "unknown" };

export type ReservationSnapshot = {
  reservation: Reservation | null;
  reservations: readonly Reservation[];
  products: readonly Product[];
};

export type ReservationStore = {
  // The decision runs against a copy. Products, the reservation, and outbox rows change together, or not at all.
  reserve(orderId: string, decide: (snapshot: ReservationSnapshot) => ReserveDecision): Promise<ReserveResult>;
  release(orderId: string, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ReleaseResult>;
  // The CloudEvents id is stored only when an active reservation is confirmed. A repeat of that id does not confirm again.
  confirm(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ConfirmDecision): Promise<ConfirmResult>;
  // The CloudEvents id is stored only when the reserved quantities come back. A repeat of that id does not add them again.
  cancel(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => CancelDecision): Promise<CancelResult>;
  // The CloudEvents id is stored only when an active reservation expires. Released and confirmed reservations record nothing.
  expire(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ExpireResult>;
  reservations(): Promise<readonly Reservation[]>;
  product(productId: string): Promise<Product | null>;
  events(): Promise<readonly AvailabilityEvent[]>;
};
