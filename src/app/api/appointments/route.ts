import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import {
  appointmentListQuerySchema,
  createAppointmentSchema,
} from "@/lib/validators/appointment";

function nextAppointmentNo(
  lastAppointmentNo?: string
) {
  const lastNumber = lastAppointmentNo
    ? Number(
        lastAppointmentNo.replace(
          "APT-",
          ""
        )
      )
    : 0;

  return `APT-${String(lastNumber + 1).padStart(
    6,
    "0"
  )}`;
}

function nextVisitNo(lastVisitNo?: string) {
  const lastNumber = lastVisitNo
    ? Number(lastVisitNo.replace("OPD-", ""))
    : 0;

  return `OPD-${String(lastNumber + 1).padStart(
    6,
    "0"
  )}`;
}

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
  patientId: string,
  doctorId?: string
) {
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

  if (!doctorId) {
    return null;
  }

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

  return null;
}

export async function POST(
  request: NextRequest
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const body =
      createAppointmentSchema.parse(
        await request.json()
      );

    const hospitalId = resolveHospitalId(
      currentUser,
      body.hospitalId
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
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
      await prisma.$transaction(
        async (tx) => {
          const lastAppointment =
            await tx.appointment.findFirst({
              where: {
                hospitalId,
              },
              orderBy: {
                appointmentNo: "desc",
              },
              select: {
                appointmentNo: true,
              },
            });

          const appt = await tx.appointment.create({
            data: {
              hospitalId,
              patientId: body.patientId,
              doctorId: body.doctorId,
              appointmentNo:
                nextAppointmentNo(
                  lastAppointment?.appointmentNo
                ),
              appointmentAt: new Date(
                body.appointmentAt
              ),
              status:
                body.status ?? "SCHEDULED",
              notes: body.notes,
            },
            include: {
              patient: true,
              doctor: true,
            },
          });

          // Create OPD visit and Vitals if vitals are provided
          if (body.vitals && (
            body.vitals.temperature ||
            body.vitals.pulse ||
            body.vitals.respiratoryRate ||
            body.vitals.bloodPressure ||
            body.vitals.oxygenSaturation ||
            body.vitals.height ||
            body.vitals.weight ||
            body.vitals.bmi
          )) {
            const lastVisit =
              await tx.opdVisit.findFirst({
                where: {
                  hospitalId,
                },
                orderBy: {
                  visitNo: "desc",
                },
                select: {
                  visitNo: true,
                },
              });

            const visit = await tx.opdVisit.create({
              data: {
                hospitalId,
                patientId: body.patientId,
                appointmentId: appt.id,
                visitNo: nextVisitNo(lastVisit?.visitNo),
                chiefComplaint: body.notes || "Initial check-in",
                status: "OPEN",
              },
            });

            await tx.vital.create({
              data: {
                hospitalId,
                patientId: body.patientId,
                visitId: visit.id,
                temperature: body.vitals.temperature || null,
                pulse: body.vitals.pulse ? Number(body.vitals.pulse) : null,
                respiratoryRate: body.vitals.respiratoryRate ? Number(body.vitals.respiratoryRate) : null,
                bloodPressure: body.vitals.bloodPressure || null,
                oxygenSaturation: body.vitals.oxygenSaturation ? Number(body.vitals.oxygenSaturation) : null,
                height: body.vitals.height || null,
                weight: body.vitals.weight || null,
                bmi: body.vitals.bmi || null,
              },
            });
          }

          return appt;
        }
      );

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
      "Failed to create appointment",
      500
    );
  }
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
      appointmentListQuerySchema.parse(
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
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
      ...(query.patientId
        ? {
            patientId: query.patientId,
          }
        : {}),
      ...(query.doctorId
        ? {
            doctorId: query.doctorId,
          }
        : {}),
      ...(query.from || query.to
        ? {
            appointmentAt: {
              ...(query.from
                ? {
                    gte: new Date(query.from),
                  }
                : {}),
              ...(query.to
                ? {
                    lte: new Date(query.to),
                  }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                appointmentNo: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                patient: {
                  patientCode: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                patient: {
                  firstName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                patient: {
                  lastName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                patient: {
                  phone: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                doctor: {
                  fullName: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip =
      (query.page - 1) * query.limit;

    const [appointments, total] =
      await prisma.$transaction([
        prisma.appointment.findMany({
          where,
          include: {
            patient: true,
            doctor: true,
          },
          orderBy: {
            appointmentAt: "desc",
          },
          skip,
          take: query.limit,
        }),
        prisma.appointment.count({
          where,
        }),
      ]);

    return success({
      appointments,
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
      "Failed to fetch appointments",
      500
    );
  }
}
