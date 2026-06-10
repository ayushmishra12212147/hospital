import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { updateHospitalSchema } from "@/lib/validators/hospital";
import { requirePermission, requireCurrentUser } from "@/lib/tenant-guards";

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
    const { user, response } = await requireCurrentUser(
      request
    );

    if (!user) {
      return response;
    }

    const { id } = await params;

    const hospital = await prisma.hospital.findUnique({
      where: { id },
    });

    if (!hospital) {
      return failure("Hospital not found", 404);
    }

    if (!canAccessHospital(user, hospital.id)) {
      return failure("Forbidden", 403);
    }

    return success(hospital);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch hospital", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requirePermission(
      request,
      "hospital.edit"
    );

    if (!user) {
      return response;
    }

    const { id } = await params;
    const body = updateHospitalSchema.parse(await request.json());

    const existingHospital = await prisma.hospital.findUnique({
      where: { id },
    });

    if (!existingHospital) {
      return failure("Hospital not found", 404);
    }

    if (!canAccessHospital(user, existingHospital.id)) {
      return failure("Forbidden", 403);
    }

    if (body.subdomain) {
      const duplicate = await prisma.hospital.findFirst({
        where: {
          subdomain: body.subdomain,
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        return failure("Subdomain already exists", 409);
      }
    }

    const data = {
      ...(body.name ? { name: body.name } : {}),
      ...(body.subdomain ? { subdomain: body.subdomain } : {}),
      ...(body.logo !== undefined ? { logo: body.logo } : {}),
      ...(body.loginImage1 !== undefined ? { loginImage1: body.loginImage1 } : {}),
      ...(body.loginImage2 !== undefined ? { loginImage2: body.loginImage2 } : {}),
      ...(body.loginImage3 !== undefined ? { loginImage3: body.loginImage3 } : {}),
      ...(user.userType === "SUPER_ADMIN" &&
      body.status !== undefined
        ? { status: body.status }
        : {}),
    };

    const hospital = await prisma.hospital.update({
      where: { id },
      data,
    });

    return success(hospital);
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(error.issues[0]?.message ?? "Validation failed", 400);
    }

    return failure("Failed to update hospital", 500);
  }
}
