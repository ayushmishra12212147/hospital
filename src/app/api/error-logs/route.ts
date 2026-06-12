import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { requireCurrentUser, resolveHospitalIdForUser } from "@/lib/tenant-guards";

const errorLogQuerySchema = z.object({
  hospitalId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireCurrentUser(request);
    if (!user) {
      return response;
    }

    const query = errorLogQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalIdForUser(user, query.hospitalId);

    // Only SUPER_ADMIN can view error logs without filtering by a specific hospital
    if (!hospitalId && user.userType !== "SUPER_ADMIN") {
      return failure("Hospital is required", 400);
    }

    const where = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(query.search
        ? {
            OR: [
              { message: { contains: query.search, mode: "insensitive" as const } },
              { endpoint: { contains: query.search, mode: "insensitive" as const } },
              { method: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [logs, total] = await prisma.$transaction([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return success({
      errorLogs: logs,
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
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }
    return failure("Failed to fetch error logs", 500);
  }
}

const createErrorLogSchema = z.object({
  hospitalId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  endpoint: z.string().optional(),
  method: z.string().optional(),
  message: z.string().min(1),
  stack: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = createErrorLogSchema.parse(await request.json());

    const log = await prisma.errorLog.create({
      data: {
        hospitalId: body.hospitalId || null,
        userId: body.userId || null,
        endpoint: body.endpoint || null,
        method: body.method || null,
        message: body.message,
        stack: body.stack || null,
      },
    });

    return success(log);
  } catch (error) {
    console.error("Failed to log error to DB:", error);
    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }
    return failure("Failed to record error log", 500);
  }
}
