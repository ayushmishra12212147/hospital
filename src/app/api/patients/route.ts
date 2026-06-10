import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import {
  createPatientSchema,
  patientListQuerySchema,
} from "@/lib/validators/patient";

function nextPatientCode(
  lastPatientCode?: string
) {
  const lastNumber = lastPatientCode
    ? Number(
        lastPatientCode.replace(
          "PAT-",
          ""
        )
      )
    : 0;

  return `PAT-${String(lastNumber + 1).padStart(
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
      createPatientSchema.parse(
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

    const hospital =
      await prisma.hospital.findUnique({
        where: {
          id: hospitalId,
        },
      });

    if (!hospital?.status) {
      return failure(
        "Hospital not found or disabled",
        404
      );
    }

    const patient =
      await prisma.$transaction(
        async (tx) => {
          const lastPatient =
            await tx.patient.findFirst({
              where: {
                hospitalId,
              },
              orderBy: {
                patientCode: "desc",
              },
              select: {
                patientCode: true,
              },
            });

          return tx.patient.create({
            data: {
              ...body,
              hospitalId,
              patientCode: nextPatientCode(
                lastPatient?.patientCode
              ),
              dateOfBirth:
                body.dateOfBirth
                  ? new Date(body.dateOfBirth)
                  : undefined,
            },
          });
        }
      );

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
      "Failed to create patient",
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
      patientListQuerySchema.parse(
        Object.fromEntries(
          request.nextUrl.searchParams
        )
      );

    const hospitalId = resolveHospitalId(
      currentUser,
      query.hospitalId
    );

    if (currentUser.userType !== "SUPER_ADMIN" && !hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const search = query.search;
    const where = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(search
        ? {
            OR: [
              {
                patientCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                firstName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                middleName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                phone: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                aadhaarNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip =
      (query.page - 1) * query.limit;

    const [patients, total] =
      await prisma.$transaction([
        prisma.patient.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: query.limit,
        }),
        prisma.patient.count({
          where,
        }),
      ]);

    return success({
      patients,
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
      "Failed to fetch patients",
      500
    );
  }
}
