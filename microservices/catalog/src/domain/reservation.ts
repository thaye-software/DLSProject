import type { Money } from "./product.js";

export const RESERVATION_STATUSES = ["active", "released", "confirmed"] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export type ReservationLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  thumbnailUrl: string | null;
};

export type Reservation = {
  reservationId: string;
  orderId: string;
  status: ReservationStatus;
  items: ReservationLine[];
  expiresAt: Date;
  createdAt: Date;
};
