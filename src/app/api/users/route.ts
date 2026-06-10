import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { createUserSchema } from "@/lib/validators/user";
import { requirePermission } from "@/lib/tenant-guards";
import { logActivity, logAudit } from "@/lib/security";

const userListQuerySchema = z.object({
  hospitalId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function resolveHospitalId(
  user: { userType: string; hospitalId: string | null },
  requestedHospitalId?: string
) {
  if (user.userType === "SUPER_ADMIN") {
    return requestedHospitalId ?? null;
  }

  if (requestedHospitalId && requestedHospitalId !== user.hospitalId) {
    return null;
  }

  return user.hospitalId;
}

export async function POST(request: NextRequest) {
  try {
    const { user: currentUser, response } = await requirePermission(
      request,
      "user.create"
    );

    if (!currentUser) {
      return response;
    }

    const body = createUserSchema.parse(await request.json());
    const hospitalId = resolveHospitalId(currentUser, body.hospitalId);

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username: body.username,
      },
    });

    if (existingUser) {
      return failure("Username already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        hospitalId,
        username: body.username,
        password: hashedPassword,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        hospitalId,
        userId: user.id,
        employeeCode: body.employeeCode,
        fullName: body.fullName,
        designation: body.designation,
        department: body.department,
      },
    });

    await logAudit({
      hospitalId,
      actorUserId: currentUser.id,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      metadata: {
        employeeCode: employee.employeeCode,
      },
    });

    await logActivity({
      hospitalId,
      actorUserId: currentUser.id,
      category: "admin",
      title: "User created",
      details: `${body.username} / ${body.fullName}`,
    });

    return success({
      user,
      employee,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to create user", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user: currentUser, response } = await requirePermission(
      request,
      "user.view"
    );

    if (!currentUser) {
      return response;
    }

    const query = userListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalId(currentUser, query.hospitalId);

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const where = {
      hospitalId,
      ...(query.search
        ? {
            OR: [
              {
                username: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                employee: {
                  fullName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                employee: {
                  employeeCode: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          employee: true,
          hospital: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return success({
      users,
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

    return failure("Failed to fetch users", 500);
  }
}
