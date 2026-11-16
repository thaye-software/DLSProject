import { z } from "zod";

// Coerce string inputs from HTML forms into the correct types for validation.
export const createNewWatchSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(2, "Model is required"),
  description: z.string().min(10, "Description is required"),
  reference: z.string().min(2, "Reference is required"),
  serialNumber: z.string().min(2, "Serial number is required"),
  year: z.coerce
    .number()
    .int()
    .gte(1000, "Year must be 4 digits")
    .lte(9999, "Year must be 4 digits"),
  size: z.string().optional(),
  movement: z.string().optional(),
  glassType: z.string().optional(),
  limited: z
    .preprocess((val) => {
      if (typeof val === "string") return val === "true";
      return val;
    }, z.boolean())
    .optional(),
  box: z
    .preprocess((val) => {
      if (typeof val === "string") return val === "true";
      return val;
    }, z.boolean())
    .optional(),
  papers: z
    .preprocess((val) => {
      if (typeof val === "string") return val === "true";
      return val;
    }, z.boolean())
    .optional(),
  condition: z.coerce
    .number()
    .int()
    .min(1, "Condition must be between 1 and 10")
    .max(10, "Condition must be between 1 and 10"),
  price: z.coerce.number().min(0, "Price must be a positive number").optional(),
  braceletType: z.string().optional(),
  braceletColor: z.string().optional(),
  dialColor: z.string().optional(),
  vat: z.coerce.number().min(0, "VAT must be a positive number").optional(),
});
