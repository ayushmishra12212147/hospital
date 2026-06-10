import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalDate = z
  .string()
  .datetime()
  .optional();

export const createPatientSchema = z.object({
  hospitalId: z.string().optional(),

  firstName: z.string().trim().min(1),
  middleName: optionalTrimmedString,
  lastName: optionalTrimmedString,

  gender: z.enum([
    "MALE",
    "FEMALE",
    "OTHER",
  ]),

  dateOfBirth: optionalDate,

  phone: optionalTrimmedString,
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),

  bloodGroup: z
    .enum([
      "A_POSITIVE",
      "A_NEGATIVE",
      "B_POSITIVE",
      "B_NEGATIVE",
      "AB_POSITIVE",
      "AB_NEGATIVE",
      "O_POSITIVE",
      "O_NEGATIVE",
    ])
    .optional(),

  maritalStatus: z
    .enum([
      "SINGLE",
      "MARRIED",
      "DIVORCED",
      "WIDOWED",
    ])
    .optional(),

  occupation: optionalTrimmedString,
  nationality: optionalTrimmedString,
  aadhaarNumber: optionalTrimmedString,

  address: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  country: optionalTrimmedString,
  pincode: optionalTrimmedString,

  emergencyName: optionalTrimmedString,
  emergencyPhone: optionalTrimmedString,
  emergencyRelation: optionalTrimmedString,

  allergies: optionalTrimmedString,
  remarks: optionalTrimmedString,
});

export const updatePatientSchema =
  createPatientSchema
    .omit({
      hospitalId: true,
    })
    .partial()
    .extend({
      isActive: z.boolean().optional(),
    });

export const patientListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
});
