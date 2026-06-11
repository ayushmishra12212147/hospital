import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const appointmentStatusSchema = z.enum([
  "SCHEDULED",
  "CHECKED_IN",
  "IN_CONSULTATION",
  "COMPLETED",
  "CANCELLED",
]);

export const createAppointmentSchema =
  z.object({
    hospitalId: z.string().optional(),
    patientId: z.string().min(1),
    doctorId: optionalTrimmedString,
    appointmentAt: z.string().datetime(),
    status: appointmentStatusSchema.optional(),
    notes: optionalTrimmedString,
    vitals: z
      .object({
        temperature: z.string().trim().optional().nullable().transform((v) => v || undefined),
        pulse: z.coerce.number().int().optional().nullable(),
        respiratoryRate: z.coerce.number().int().optional().nullable(),
        bloodPressure: z.string().trim().optional().nullable().transform((v) => v || undefined),
        oxygenSaturation: z.coerce.number().int().optional().nullable(),
        height: z.string().trim().optional().nullable().transform((v) => v || undefined),
        weight: z.string().trim().optional().nullable().transform((v) => v || undefined),
        bmi: z.string().trim().optional().nullable().transform((v) => v || undefined),
      })
      .optional(),
  });


export const updateAppointmentSchema =
  z.object({
    patientId: z.string().min(1).optional(),
    doctorId: optionalTrimmedString,
    appointmentAt: z
      .string()
      .datetime()
      .optional(),
    status: appointmentStatusSchema.optional(),
    notes: optionalTrimmedString,
  });

export const appointmentListQuerySchema =
  z.object({
    hospitalId: z.string().optional(),
    search: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().optional()
    ),
    status: z.preprocess(
      (val) => (val === "" ? undefined : val),
      appointmentStatusSchema.optional()
    ),
    patientId: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional()
    ),
    doctorId: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional()
    ),
    from: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().datetime().optional()
    ),
    to: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().datetime().optional()
    ),
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),
  });
