import type { Address, Order, OrderStatus } from "./order.js";

type Money = { amount_minor: number; currency: "DKK" };
type AddressData = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  zip_code: string;
  state_province: string | null;
  country_code: string;
};

// The data of each event Orders publishes on order.events (docs/contracts/asyncapi.yaml).
export type OrderEventData = {
  order_confirmed: {
    order_id: string;
    user_id: string;
    customer_email: string;
    status: "PENDING";
    items: { product_id: string; product_name: string; quantity: number; thumbnail_url: string | null }[];
    totals: { subtotal: Money; shipping: Money; total: Money };
    billing_address: AddressData;
    delivery_address: AddressData;
    confirmed_at: string;
  };
  refund_requested: {
    refund_request_id: string;
    order_id: string;
    user_id: string;
    amount: Money;
    reason: "paid_after_expiry" | "cancelled_after_payment" | "admin";
    requested_at: string;
  };
  order_cancelled: {
    order_id: string;
    user_id: string;
    previous_status: OrderStatus;
    reason: "customer_request" | "admin";
    items: { product_id: string; quantity: number }[];
    was_paid: boolean;
    cancelled_at: string;
  };
  order_expired: {
    order_id: string;
    user_id: string;
    items: { product_id: string; quantity: number }[];
    reserved_at: string;
    expired_at: string;
  };
  order_status_changed: {
    order_id: string;
    user_id: string;
    previous_status: OrderStatus;
    status: OrderStatus;
    items: { product_id: string; quantity: number }[];
    changed_by: string;
    changed_at: string;
  };
};

export type OrderEventType = keyof OrderEventData;

export type OrderEvent<T extends OrderEventType = OrderEventType> = {
  specversion: "1.0";
  id: string;
  source: "/services/orders";
  type: T;
  time: string;
  datacontenttype: "application/json";
  subject: string;
  dataversion: 1;
  correlationid: string;
  causationid: string | null;
  data: OrderEventData[T];
};

export type NewOrderEvent<T extends OrderEventType> = {
  id: string;
  type: T;
  orderId: string;
  time: Date;
  causationId: string | null;
  data: OrderEventData[T];
};

export function buildOrderEvent<T extends OrderEventType>({ id, type, orderId, time, causationId, data }: NewOrderEvent<T>): OrderEvent<T> {
  return {
    specversion: "1.0",
    id,
    source: "/services/orders",
    type,
    time: time.toISOString(),
    datacontenttype: "application/json",
    subject: orderId,
    dataversion: 1,
    // The order id is the id of the whole checkout flow (docs/contracts/README.md).
    correlationid: orderId,
    causationid: causationId,
    data,
  };
}

export const dkk = (amountMinor: number): Money => ({ amount_minor: amountMinor, currency: "DKK" });

export function addressData(address: Address): AddressData {
  return {
    first_name: address.firstName,
    middle_name: address.middleName,
    last_name: address.lastName,
    address_line_1: address.addressLine1,
    address_line_2: address.addressLine2,
    city: address.city,
    zip_code: address.zipCode,
    state_province: address.stateProvince,
    country_code: address.countryCode,
  };
}

export function orderConfirmedData(order: Order, confirmedAt: Date): OrderEventData["order_confirmed"] {
  return {
    order_id: order.id,
    user_id: order.userId,
    customer_email: order.customerEmail,
    status: "PENDING",
    items: order.items.map((line) => ({
      product_id: line.productId,
      product_name: line.productName,
      quantity: line.quantity,
      thumbnail_url: line.thumbnailUrl,
    })),
    totals: { subtotal: dkk(order.subTotalDkk), shipping: dkk(order.shippingPriceDkk), total: dkk(order.totalPriceDkk) },
    billing_address: addressData(order.billingAddress),
    delivery_address: addressData(order.deliveryAddress),
    confirmed_at: confirmedAt.toISOString(),
  };
}
