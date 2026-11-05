import { z } from "zod";

export const refundRequestedDataSchema = z.object({
  refund_request_id: z.uuid(),
  order_id: z.uuid(),
  amount: z.object({
    amount_minor: z.number().int().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
});
