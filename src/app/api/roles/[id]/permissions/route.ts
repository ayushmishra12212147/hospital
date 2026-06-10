import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { requirePermission } from "@/lib/tenant-guards";

const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().min(1)).default([]),
});

function canAccessHospital(
  currentUser: { userType: string; hospitalId: string | null },
  hospitalId: string | null
) {
  return (
    currentUser.userType === "SUPER_ADMIN" ||
    currentUser.hospitalId === hospitalId
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requirePermission(
      request,
      "role.edit"
    );

    if (!user) {
      return response;
    }

    const { id } = await params;
    const body = assignPermissionsSchema.parse(await request.json());

    const role = await prisma.role.findUnique({
      where: { id },
      select: { hospitalId: true },
    });

    if (!role) {
      return failure("Role not found", 404);
    }

    if (!canAccessHospital(user, role.hospitalId)) {
      return failure("Forbidden", 403);
    }

    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    for (const permissionId of body.permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: id,
          permissionId,
        },
      });
    }

    return success({
      message: "Permissions assigned",
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to assign permissions", 500);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requirePermission(
      request,
      "role.view"
    );

    if (!user) {
      return response;
    }

    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      select: { hospitalId: true },
    });

    if (!role) {
      return failure("Role not found", 404);
    }

    if (!canAccessHospital(user, role.hospitalId)) {
      return failure("Forbidden", 403);
    }

    const permissions = await prisma.rolePermission.findMany({
      where: {
        roleId: id,
      },
      include: {
        permission: true,
      },
    });

    return success(permissions);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch role permissions", 500);
  }
}
