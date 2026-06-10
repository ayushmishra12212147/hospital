import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

export const radiologyOrderStatusSchema = z.enum([
  "REQUESTED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
]);

export const radiologyPrioritySchema = z.enum([
  "ROUTINE",
  "URGENT",
  "STAT",
]);

export const radiologyOrderItemSchema = z.object({
  procedureName: z.string().trim().min(1),
  bodyPart: optionalText,
  laterality: optionalText,
  findings: optionalText,
  remarks: optionalText,
});

export const createRadiologyOrderSchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().min(1),
  opdVisitId: optionalText,
  requestedByEmployeeId: optionalText,
  notes: optionalText,
  status: radiologyOrderStatusSchema.optional(),
  priority: radiologyPrioritySchema.optional(),
  items: z.array(radiologyOrderItemSchema).min(1),
});

export const updateRadiologyOrderSchema = z.object({
  notes: optionalText,
  status: radiologyOrderStatusSchema.optional(),
  priority: radiologyPrioritySchema.optional(),
  items: z.array(radiologyOrderItemSchema).min(1).optional(),
});

export const radiologyOrderListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().optional(),
  opdVisitId: z.string().optional(),
  status: radiologyOrderStatusSchema.optional(),
  priority: radiologyPrioritySchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
});
