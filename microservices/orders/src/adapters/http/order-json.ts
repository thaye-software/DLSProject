import { z } from "zod";
import { ORDER_STATUSES, type Address, type Order } from "../../domain/order.js";

// Requests: CreateOrderRequest and Address in docs/contracts/openapi.yaml.
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => requiredText(max).nullable();

const addressSchema = z.strictObject({
  first_name: requiredText(255),
  middle_name: optionalText(255),
  last_name: requiredText(255),
  address_line_1: requiredText(255),
  address_line_2: optionalText(255),
  city: requiredText(255),
  zip_code: requiredText(20),
  state_province: optionalText(255),
  country_code: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code"),
});

export const createOrderRequestSchema = z.strictObject({
  items: z
    .array(z.strictObject({ product_id: z.uuid(), quantity: z.number().int().min(1) }))
    .min(1)
    .refine((items) => new Set(items.map((item) => item.product_id)).size === items.length, "must not repeat a product_id"),
  offer_token: z.string().nullable(),
  billing_address: addressSchema,
  delivery_address: addressSchema,
});

// Query of GET /orders. Express parses a repeated ?status= into an array and a single one into a string.
const orderStatusSchema = z.enum(ORDER_STATUSES);
export const listOrdersQuerySchema = z.object({
  status: z
    .union([orderStatusSchema, z.array(orderStatusSchema)])
    .optional()
    .transform((status) => (status === undefined ? [] : Array.isArray(status) ? status : [status])),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export function toAddress(json: z.infer<typeof addressSchema>): Address {
  return {
    firstName: json.first_name,
    middleName: json.middle_name,
    lastName: json.last_name,
    addressLine1: json.address_line_1,
    addressLine2: json.address_line_2,
    city: json.city,
    zipCode: json.zip_code,
    stateProvince: json.state_province,
    countryCode: json.country_code,
  };
}

// Responses: the Order schema in docs/contracts/openapi.yaml.
const dkk = (amountMinor: number) => ({ amount_minor: amountMinor, currency: "DKK" });

function addressJson(address: Address) {
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

export function orderJson(order: Order) {
  return {
    order_id: order.id,
    user_id: order.userId,
    customer_email: order.customerEmail,
    status: order.status,
    items: order.items.map((line) => ({
      product_id: line.productId,
      product_name: line.productName,
      quantity: line.quantity,
      thumbnail_url: line.thumbnailUrl,
    })),
    totals: {
      subtotal: dkk(order.subTotalDkk),
      shipping: dkk(order.shippingPriceDkk),
      total: dkk(order.totalPriceDkk),
    },
    billing_address: addressJson(order.billingAddress),
    delivery_address: addressJson(order.deliveryAddress),
    created_at: order.createdAt.toISOString(),
    // The contract only shows expires_at while the order is RESERVED.
    expires_at: order.status === "RESERVED" && order.expiresAt ? order.expiresAt.toISOString() : null,
  };
}
