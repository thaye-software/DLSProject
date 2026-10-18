import { orderCancelled } from "./change-order.js";
import type { AnonymiseResult, Anonymised, UserDataStore } from "./ports/user-data-store.js";

// What a deleted user's orders show instead of their personal data. The user id, city, zip code, state and
// country stay, so order statistics stay correct. `.invalid` can never be a real
// address (RFC 2606), yet it still passes the contract's email format.
export const ANONYMISED: Anonymised = {
  customerEmail: "deleted-user@anonymised.invalid",
  firstName: "Deleted",
  middleName: null,
  lastName: "User",
  addressLine1: "Deleted",
  addressLine2: null,
};

export type UserDeletedDependencies = {
  store: UserDataStore;
  now: () => Date;
  newId: () => string;
};

// Unpaid orders are cancelled too, so their stock goes back now and no confirmation is ever sent to the
// anonymised address. Deleting the account is the customer's own doing, hence reason customer_request.
export function onUserDeleted(userId: string, eventId: string, { store, now, newId }: UserDeletedDependencies): Promise<AnonymiseResult> {
  return store.anonymiseUser({
    eventId,
    userId,
    replacement: ANONYMISED,
    cancelEvent: (order) => orderCancelled(order, "customer_request", now(), newId),
  });
}
