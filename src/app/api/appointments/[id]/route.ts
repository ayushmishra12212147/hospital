import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { updateAppointmentSchema } from "@/lib/validators/appointment";

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

async function validateAppointmentRelations(
  hospitalId: string,
  patientId?: string,
  doctorId?: string
) {
  if (patientId) {
    const patient =
      await prisma.patient.findFirst({
        where: {
          id: patientId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!patient) {
      return "Patient not found";
    }
  }

  if (doctorId) {
    const doctor =
      await prisma.employee.findFirst({
        where: {
          id: doctorId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!doctor) {
      return "Doctor not found";
    }
  }

  return null;
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

    const appointment =
      await prisma.appointment.findFirst({
        where: {
          id,
          hospitalId,
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

    if (!appointment) {
      return failure(
        "Appointment not found",
        404
      );
    }

    return success(appointment);
  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch appointment",
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
      updateAppointmentSchema.parse(
        await request.json()
      );

    const existingAppointment =
      await prisma.appointment.findFirst({
        where: {
          id,
          hospitalId,
        },
        select: {
          id: true,
        },
      });

    if (!existingAppointment) {
      return failure(
        "Appointment not found",
        404
      );
    }

    const relationError =
      await validateAppointmentRelations(
        hospitalId,
        body.patientId,
        body.doctorId
      );

    if (relationError) {
      return failure(relationError, 404);
    }

    const appointment =
      await prisma.appointment.update({
        where: {
          id,
        },
        data: {
          ...body,
          appointmentAt:
            body.appointmentAt
              ? new Date(body.appointmentAt)
              : undefined,
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

    return success(appointment);
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
      "Failed to update appointment",
      500
    );
  }
}
