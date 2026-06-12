import { prisma } from "@/lib/prisma";

export async function logErrorToDb(params: {
  hospitalId?: string | null;
  userId?: string | null;
  endpoint?: string;
  method?: string;
  message: string;
  stack?: string;
}) {
  try {
    await prisma.errorLog.create({
      data: {
        hospitalId: params.hospitalId || null,
        userId: params.userId || null,
        endpoint: params.endpoint || null,
        method: params.method || null,
        message: params.message,
        stack: params.stack || null,
      },
    });
  } catch (err) {
    console.error("Database error logging failed:", err);
  }
}
