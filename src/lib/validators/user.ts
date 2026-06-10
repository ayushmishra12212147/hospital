import { z } from "zod";

export const createUserSchema = z.object({
  hospitalId: z.string(),

  username: z.string().min(3),

  password: z.string().min(6),

  employeeCode: z.string(),

  fullName: z.string(),

  designation: z.string(),

  department: z.string().optional(),
});