import type { Reservation } from "../../domain/reservation.js";

export type OrderEventInput = {
  id: string;
  type: string;
  orderId: string;
};

export type ApplyOrderEventResult = "applied" | "duplicate" | "unknown";

export type StockWriter = {
  setStock(productId: string, stock: number): Promise<void>;
};

export type OrderEventInbox = {
  // The CloudEvents id is stored only when the stock change commits. A repeat does not run the handler.
  // An order with no reservation is left untouched and records nothing.
  apply(
    event: OrderEventInput,
    changeStock: (reservation: Reservation, stock: StockWriter) => Promise<void>,
  ): Promise<ApplyOrderEventResult>;
};
