import "server-only";
import { gatewayFetch } from "@/lib/gateway";
import type { Money } from "@/lib/money";

// Typed from docs/contracts/openapi.yaml. The live Orders service also requires
// state_province and country_code on Address (strict schema); the contract's Address omits them.
export type Address = {
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
export type OrderStatus =
  | "RESERVED" | "EXPIRED" | "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
export type CreateOrderRequest = {
  items: { product_id: string; quantity: number }[];
  offer_token: string | null;
  billing_address: Address;
  delivery_address: Address;
};
export type Order = {
  order_id: string;
  user_id: string;
  customer_email: string;
  status: OrderStatus;
  items: { product_id: string; product_name: string; quantity: number; thumbnail_url: string | null }[];
  totals: { subtotal: Money; shipping: Money; total: Money };
  billing_address: Address;
  delivery_address: Address;
  created_at: string;
  expires_at: string | null;
};
export type OrderPage = { items: Order[]; page: number; page_size: number; total: number };
export type UpdateOrderStatusRequest = {
  status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
};

// Orders rejects any non-null offer_token (422), so it is always null here.
// The caller owns the Idempotency-Key (one per form), so Orders replays a retried submit instead of reserving twice.
export const createOrder = (request: Omit<CreateOrderRequest, "offer_token">, idempotencyKey: string) =>
  gatewayFetch<Order>("/orders", {
    method: "POST",
    body: { ...request, offer_token: null },
    headers: { "idempotency-key": idempotencyKey },
  });

export const getOrder = (orderId: string) => gatewayFetch<Order>(`/orders/${encodeURIComponent(orderId)}`);

export const listOrders = (page?: number) => gatewayFetch<OrderPage>("/orders", { query: { page } });

export const cancelOrder = (orderId: string) =>
  gatewayFetch<Order>(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });

export const updateOrderStatus = (orderId: string, body: UpdateOrderStatusRequest) =>
  gatewayFetch<Order>(`/orders/${encodeURIComponent(orderId)}/status`, { method: "PATCH", body });
