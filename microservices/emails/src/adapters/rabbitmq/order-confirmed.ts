import { z } from "zod";
import type { OrderConfirmation } from "../../domain/order-confirmation.js";

const moneySchema = z.object({
  amount_minor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const orderConfirmedDataSchema: z.ZodType<OrderConfirmation> = z.object({
  order_id: z.uuid(),
  customer_email: z.email(),
  items: z
    .array(
      z.object({
        product_name: z.string(),
        quantity: z.number().int().min(1),
        thumbnail_url: z.url().nullable(),
      }),
    )
    .min(1),
  totals: z.object({
    subtotal: moneySchema,
    shipping: moneySchema,
    total: moneySchema,
  }),
  billing_address: z.object({
    first_name: z.string(),
    middle_name: z.string().nullable(),
    last_name: z.string(),
  }),
  confirmed_at: z.iso.datetime({ offset: true }),
});
