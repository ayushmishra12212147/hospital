import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const amountSchema = z.coerce.number().min(0);

export const billStatusSchema = z.enum([
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);

export const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "INSURANCE",
  "OTHER",
]);

export const billItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: amountSchema,
});

export const createBillSchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().min(1),
  opdVisitId: optionalText,
  notes: optionalText,
  discount: amountSchema.optional(),
  tax: amountSchema.optional(),
  status: billStatusSchema.optional(),
  paymentAmount: amountSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paymentReferenceNo: optionalText,
  paymentNotes: optionalText,
  items: z.array(billItemSchema).min(1),
});

export const updateBillSchema = z.object({
  notes: optionalText,
  discount: amountSchema.optional(),
  tax: amountSchema.optional(),
  status: billStatusSchema.optional(),
  paymentAmount: amountSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paymentReferenceNo: optionalText,
  paymentNotes: optionalText,
  items: z.array(billItemSchema).optional(),
});

export const billListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().optional(),
  opdVisitId: z.string().optional(),
  status: billStatusSchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
});
