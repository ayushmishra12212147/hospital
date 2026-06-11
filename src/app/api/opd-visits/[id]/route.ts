import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { updateOpdVisitSchema } from "@/lib/validators/opd";

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

    const visit =
      await prisma.opdVisit.findFirst({
        where: {
          id,
          hospitalId,
        },
        include: opdInclude,
      });

    if (!visit) {
      return failure(
        "OPD visit not found",
        404
      );
    }

    return success(visit);
  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch OPD visit",
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
      updateOpdVisitSchema.parse(
        await request.json()
      );

    const existingVisit =
      await prisma.opdVisit.findFirst({
        where: {
          id,
          hospitalId,
        },
        select: {
          id: true,
          patientId: true,
        },
      });

    if (!existingVisit) {
      return failure(
        "OPD visit not found",
        404
      );
    }

    const visit =
      await prisma.$transaction(
        async (tx) => {
          if (body.vitals) {
            await tx.vital.upsert({
              where: {
                visitId: id,
              },
              update: body.vitals,
              create: {
                ...body.vitals,
                visitId: id,
                hospitalId,
                patientId:
                  existingVisit.patientId,
              },
            });
          }

          if (
            body.prescriptionNotes !== undefined ||
            body.prescriptionItems
          ) {
            const prescription =
              await tx.prescription.upsert({
                where: {
                  visitId: id,
                },
                update: {
                  notes:
                    body.prescriptionNotes,
                },
                create: {
                  visitId: id,
                  notes:
                    body.prescriptionNotes,
                },
              });

            if (body.prescriptionItems) {
              await tx.prescriptionItem.deleteMany({
                where: {
                  prescriptionId:
                    prescription.id,
                },
              });

              if (
                body.prescriptionItems.length > 0
              ) {
                await tx.prescriptionItem.createMany({
                  data: body.prescriptionItems.map(
                    (item) => ({
                      medicineName: item.medicineName,
                      dosage: item.dosage ?? null,
                      frequency: item.frequency ?? null,
                      duration: item.duration ?? null,
                      instructions: item.instructions ?? null,
                      prescriptionId:
                        prescription.id,
                    })
                  ),
                });
              }
            }
          }

          return tx.opdVisit.update({
            where: {
              id,
            },
            data: {
              chiefComplaint:
                body.chiefComplaint,
              diagnosis: body.diagnosis,
              clinicalNotes:
                body.clinicalNotes,
              treatmentPlan:
                body.treatmentPlan,
              status: body.status,
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
      `Failed to update OPD visit: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}
