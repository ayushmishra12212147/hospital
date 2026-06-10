import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { createRoleSchema } from "@/lib/validators/role";
import { requirePermission } from "@/lib/tenant-guards";

const roleListQuerySchema = z.object({
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
    const { user, response } = await requirePermission(
      request,
      "role.create"
    );

    if (!user) {
      return response;
    }

    const body = createRoleSchema.parse(await request.json());
    const hospitalId = resolveHospitalId(user, body.hospitalId);

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const existingRole = await prisma.role.findFirst({
      where: {
        hospitalId,
        name: body.name,
      },
    });

    if (existingRole) {
      return failure("Role already exists", 409);
    }

    const role = await prisma.role.create({
      data: {
        hospitalId,
        name: body.name,
      },
    });

    return success(role);
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to create role", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requirePermission(
      request,
      "role.view"
    );

    if (!user) {
      return response;
    }

    const query = roleListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalId(user, query.hospitalId);

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const where = {
      hospitalId,
      ...(query.search
        ? {
            name: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [roles, total] = await prisma.$transaction([
      prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          users: {
            include: {
              user: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
        skip,
        take: query.limit,
      }),
      prisma.role.count({ where }),
    ]);

    return success({
      roles,
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

    return failure("Failed to fetch roles", 500);
  }
}
