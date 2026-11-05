import { z } from "zod";

// Data of order_cancelled and order_expired.
export const orderReferenceSchema = z.object({ order_id: z.uuid() });
