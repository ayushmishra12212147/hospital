import { z } from "zod";

export const createHospitalSchema = z.object({
  name: z.string().min(2),
  subdomain: z.string().min(2),
});

export const updateHospitalSchema = z.object({
  name: z.string().min(2).optional(),
  subdomain: z.string().min(2).optional(),
  status: z.boolean().optional(),
  logo: z.string().optional().nullable(),
  loginImage1: z.string().optional().nullable(),
  loginImage2: z.string().optional().nullable(),
  loginImage3: z.string().optional().nullable(),
});
