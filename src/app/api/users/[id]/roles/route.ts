import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { requirePermission } from "@/lib/tenant-guards";

const assignUserRoleSchema = z.object({
  roleId: z.string().min(1),
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
    const { user: currentUser, response } = await requirePermission(
      request,
      "user.edit"
    );

    if (!currentUser) {
      return response;
    }

    const { id } = await params;
    const body = assignUserRoleSchema.parse(await request.json());

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { hospitalId: true },
    });

    if (!targetUser) {
      return failure("User not found", 404);
    }

    if (!canAccessHospital(currentUser, targetUser.hospitalId)) {
      return failure("Forbidden", 403);
    }

    const role = await prisma.role.findUnique({
      where: { id: body.roleId },
      select: { hospitalId: true },
    });

    if (!role) {
      return failure("Role not found", 404);
    }

    if (!canAccessHospital(currentUser, role.hospitalId)) {
      return failure("Forbidden", 403);
    }

    // Clear existing roles to support overriding the role
    await prisma.userRole.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: id,
        roleId: body.roleId,
      },
    });

    return success({
      message: "Role assigned",
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to assign role", 500);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: currentUser, response } = await requirePermission(
      request,
      "user.view"
    );

    if (!currentUser) {
      return response;
    }

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { hospitalId: true },
    });

    if (!targetUser) {
      return failure("User not found", 404);
    }

    if (!canAccessHospital(currentUser, targetUser.hospitalId)) {
      return failure("Forbidden", 403);
    }

    const roles = await prisma.userRole.findMany({
      where: {
        userId: id,
      },
      include: {
        role: true,
      },
    });

    return success(roles);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch roles", 500);
  }
}
