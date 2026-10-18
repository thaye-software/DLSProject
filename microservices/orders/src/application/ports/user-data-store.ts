import type { OrderEvent } from "../../domain/order-event.js";
import type { Order } from "../../domain/order.js";

export type Anonymised = {
  customerEmail: string;
  firstName: string;
  middleName: null;
  lastName: string;
  addressLine1: string;
  addressLine2: null;
};

export type AnonymiseResult = { kind: "applied"; orders: number; cancelled: number } | { kind: "duplicate" };

export type AnonymiseInput = {
  eventId: string;
  userId: string;
  replacement: Anonymised;
  // The event announcing that one of the user's unpaid orders was cancelled.
  cancelEvent: (order: Order) => OrderEvent;
};

export type UserDataStore = {
  // In one transaction: skip an event id seen before (inbox), cancel the user's RESERVED orders (status and
  // events in the outbox), overwrite the personal data on every order of the user with `replacement`, and
  // delete the user's already published outbox rows (they hold copies of it).
  anonymiseUser(input: AnonymiseInput): Promise<AnonymiseResult>;
};
