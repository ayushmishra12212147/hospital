import { NextRequest } from "next/server";
import { ZodError, z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { success, failure } from "@/lib/api-response";

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        employee: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return failure("User not found", 404);
    }

    if (!canAccessHospital(currentUser, user.hospitalId)) {
      return failure("Forbidden", 403);
    }

    return success(user);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch user", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const { id } = await params;
    const body = updateUserSchema.parse(await request.json());

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { hospitalId: true },
    });

    if (!existingUser) {
      return failure("User not found", 404);
    }

    if (!canAccessHospital(currentUser, existingUser.hospitalId)) {
      return failure("Forbidden", 403);
    }

    const data: any = {};
    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }
    if (body.username !== undefined) {
      const usernameExists = await prisma.user.findFirst({
        where: {
          username: body.username,
          NOT: { id },
        },
      });
      if (usernameExists) {
        return failure("Username already exists", 409);
      }
      data.username = body.username;
    }
    if (body.password !== undefined) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return success(user);
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to update user", 500);
  }
}

