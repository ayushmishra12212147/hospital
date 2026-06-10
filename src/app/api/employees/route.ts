import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";

const employeeListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  search: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
});

function resolveHospitalId(
  user: {
    userType: string;
    hospitalId: string | null;
  },
  requestedHospitalId?: string
) {
  if (user.userType === "SUPER_ADMIN") {
    return requestedHospitalId ?? null;
  }

  if (
    requestedHospitalId &&
    requestedHospitalId !== user.hospitalId
  ) {
    return null;
  }

  return user.hospitalId;
}

export async function GET(
  request: NextRequest
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const query =
      employeeListQuerySchema.parse(
        Object.fromEntries(
          request.nextUrl.searchParams
        )
      );

    const hospitalId = resolveHospitalId(
      currentUser,
      query.hospitalId
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const where = {
      hospitalId,
      isActive: true,
      ...(query.designation
        ? {
            designation: {
              contains: query.designation,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.department
        ? {
            department: {
              contains: query.department,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                employeeCode: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                fullName: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                phone: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                designation: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip =
      (query.page - 1) * query.limit;

    const [employees, total] =
      await prisma.$transaction([
        prisma.employee.findMany({
          where,
          orderBy: {
            fullName: "asc",
          },
          skip,
          take: query.limit,
        }),
        prisma.employee.count({
          where,
        }),
      ]);

    return success({
      employees,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(
          total / query.limit
        ),
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ??
          "Validation failed",
        400
      );
    }

    return failure(
      "Failed to fetch employees",
      500
    );
  }
}
