import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalInt = z
  .union([
    z.coerce.number().int().min(0),
    z.literal("").transform(() => undefined),
  ])
  .optional();

export const opdVisitStatusSchema = z.enum([
  "OPEN",
  "COMPLETED",
  "CANCELLED",
]);

export const vitalSchema = z.object({
  temperature: optionalText,
  pulse: optionalInt,
  respiratoryRate: optionalInt,
  bloodPressure: optionalText,
  oxygenSaturation: optionalInt,
  height: optionalText,
  weight: optionalText,
  bmi: optionalText,
});

export const prescriptionItemSchema = z.object({
  medicineName: z.string().trim().min(1),
  dosage: optionalText,
  frequency: optionalText,
  duration: optionalText,
  instructions: optionalText,
});

export const createOpdVisitSchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().min(1),
  appointmentId: optionalText,
  chiefComplaint: optionalText,
});

export const updateOpdVisitSchema = z.object({
  chiefComplaint: optionalText,
  diagnosis: optionalText,
  clinicalNotes: optionalText,
  treatmentPlan: optionalText,
  status: opdVisitStatusSchema.optional(),
  vitals: vitalSchema.optional(),
  prescriptionNotes: optionalText,
  prescriptionItems: z
    .array(prescriptionItemSchema)
    .optional(),
});

export const opdVisitListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  status: opdVisitStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});
