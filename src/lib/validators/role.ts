import { z } from "zod";

export const createRoleSchema = z.object({
  hospitalId: z.string(),

  name: z.string().min(2),
});