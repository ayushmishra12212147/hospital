import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

export const labOrderStatusSchema = z.enum([
  "REQUESTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const labPrioritySchema = z.enum([
  "ROUTINE",
  "URGENT",
  "STAT",
]);

export const labOrderItemSchema = z.object({
  testName: z.string().trim().min(1),
  specimenType: optionalText,
  resultValue: optionalText,
  unit: optionalText,
  referenceRange: optionalText,
  remarks: optionalText,
});

export const createLabOrderSchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().min(1),
  opdVisitId: optionalText,
  requestedByEmployeeId: optionalText,
  notes: optionalText,
  status: labOrderStatusSchema.optional(),
  priority: labPrioritySchema.optional(),
  items: z.array(labOrderItemSchema).min(1),
});

export const updateLabOrderSchema = z.object({
  notes: optionalText,
  status: labOrderStatusSchema.optional(),
  priority: labPrioritySchema.optional(),
  items: z.array(labOrderItemSchema).min(1).optional(),
});

export const labOrderListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().optional(),
  opdVisitId: z.string().optional(),
  status: labOrderStatusSchema.optional(),
  priority: labPrioritySchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
});
