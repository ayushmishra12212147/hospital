import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { updatePatientSchema } from "@/lib/validators/patient";

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get(
        "hospitalId"
      ) ?? undefined
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const { id } = await params;

    const patient =
      await prisma.patient.findFirst({
        where: {
          id,
          hospitalId,
        },
        include: {
          appointments: {
            orderBy: {
              appointmentAt: "desc",
            },
          },
        },
      });

    if (!patient) {
      return failure(
        "Patient not found",
        404
      );
    }

    return success(patient);
  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch patient",
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get(
        "hospitalId"
      ) ?? undefined
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const { id } = await params;

    const body =
      updatePatientSchema.parse(
        await request.json()
      );

    const existingPatient =
      await prisma.patient.findFirst({
        where: {
          id,
          hospitalId,
        },
        select: {
          id: true,
        },
      });

    if (!existingPatient) {
      return failure(
        "Patient not found",
        404
      );
    }

    const patient =
      await prisma.patient.update({
        where: {
          id,
        },
        data: {
          ...body,
          dateOfBirth:
            body.dateOfBirth
              ? new Date(body.dateOfBirth)
              : undefined,
        },
      });

    return success(patient);
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
      "Failed to update patient",
      500
    );
  }
}
