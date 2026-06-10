import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import {
  createOpdVisitSchema,
  opdVisitListQuerySchema,
} from "@/lib/validators/opd";

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

function nextVisitNo(lastVisitNo?: string) {
  const lastNumber = lastVisitNo
    ? Number(lastVisitNo.replace("OPD-", ""))
    : 0;

  return `OPD-${String(lastNumber + 1).padStart(
    6,
    "0"
  )}`;
}

const opdInclude = {
  patient: true,
  appointment: {
    include: {
      doctor: true,
    },
  },
  vitals: true,
  prescription: {
    include: {
      items: true,
    },
  },
};

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
      createOpdVisitSchema.parse(
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

    const patient =
      await prisma.patient.findFirst({
        where: {
          id: body.patientId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!patient) {
      return failure(
        "Patient not found",
        404
      );
    }

    if (body.appointmentId) {
      const appointment =
        await prisma.appointment.findFirst({
          where: {
            id: body.appointmentId,
            hospitalId,
            patientId: body.patientId,
          },
          select: {
            id: true,
          },
        });

      if (!appointment) {
        return failure(
          "Appointment not found",
          404
        );
      }

      const existingVisit =
        await prisma.opdVisit.findUnique({
          where: {
            appointmentId:
              body.appointmentId,
          },
          include: opdInclude,
        });

      if (existingVisit) {
        return success(existingVisit);
      }
    }

    const visit =
      await prisma.$transaction(
        async (tx) => {
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

          return tx.opdVisit.create({
            data: {
              hospitalId,
              patientId: body.patientId,
              appointmentId:
                body.appointmentId,
              visitNo: nextVisitNo(
                lastVisit?.visitNo
              ),
              chiefComplaint:
                body.chiefComplaint,
            },
            include: opdInclude,
          });
        }
      );

    return success(visit);
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
      "Failed to create OPD visit",
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
      opdVisitListQuerySchema.parse(
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
      ...(query.patientId
        ? {
            patientId: query.patientId,
          }
        : {}),
      ...(query.appointmentId
        ? {
            appointmentId:
              query.appointmentId,
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };

    const skip =
      (query.page - 1) * query.limit;

    const [visits, total] =
      await prisma.$transaction([
        prisma.opdVisit.findMany({
          where,
          include: opdInclude,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: query.limit,
        }),
        prisma.opdVisit.count({
          where,
        }),
      ]);

    return success({
      visits,
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
      "Failed to fetch OPD visits",
      500
    );
  }
}
