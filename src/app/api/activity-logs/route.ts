import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import {
  requireCurrentUser,
  resolveHospitalIdForUser,
} from "@/lib/tenant-guards";

const activityLogQuerySchema = z.object({
  hospitalId: z.string().optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const query = activityLogQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalIdForUser(
      user,
      query.hospitalId
    );

    if (!hospitalId && user.userType !== "SUPER_ADMIN") {
      return failure("Hospital is required", 400);
    }

    const where = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [logs, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return success({
      activityLogs: logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(Math.ceil(total / query.limit), 1),
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Validation failed",
        400
      );
    }

    return failure("Failed to fetch activity logs", 500);
  }
}
