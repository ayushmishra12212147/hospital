import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import {
  ensureHospitalModuleEnabled,
  requireCurrentUser,
  resolveHospitalIdForUser,
} from "@/lib/tenant-guards";
import {
  createRadiologyOrderSchema,
  radiologyOrderListQuerySchema,
} from "@/lib/validators/radiology";

function nextRadiologyOrderNo(lastOrderNo?: string) {
  const lastNumber = lastOrderNo
    ? Number(lastOrderNo.replace("RAD-", ""))
    : 0;

  return `RAD-${String(lastNumber + 1).padStart(6, "0")}`;
}

const radiologyOrderInclude = {
  patient: true,
  opdVisit: {
    include: {
      appointment: true,
    },
  },
  requestedBy: true,
  items: true,
};

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const body = createRadiologyOrderSchema.parse(
      await request.json()
    );

    const hospitalId = resolveHospitalIdForUser(
      user,
      body.hospitalId
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    if (!(await ensureHospitalModuleEnabled(hospitalId, "RADIOLOGY"))) {
      return failure("Radiology module is disabled", 403);
    }

    const patient = await prisma.patient.findFirst({
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
      return failure("Patient not found", 404);
    }

    if (body.opdVisitId) {
      const opdVisit = await prisma.opdVisit.findFirst({
        where: {
          id: body.opdVisitId,
          hospitalId,
          patientId: body.patientId,
        },
        select: {
          id: true,
        },
      });

      if (!opdVisit) {
        return failure("OPD visit not found", 404);
      }
    }

    if (body.requestedByEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: body.requestedByEmployeeId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!employee) {
        return failure("Employee not found", 404);
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const lastOrder = await tx.radiologyOrder.findFirst({
        where: {
          hospitalId,
        },
        orderBy: {
          orderNo: "desc",
        },
        select: {
          orderNo: true,
        },
      });

      const created = await tx.radiologyOrder.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          opdVisitId: body.opdVisitId,
          requestedByEmployeeId: body.requestedByEmployeeId,
          orderNo: nextRadiologyOrderNo(lastOrder?.orderNo),
          status: body.status ?? "REQUESTED",
          priority: body.priority ?? "ROUTINE",
          notes: body.notes,
        },
      });

      await tx.radiologyOrderItem.createMany({
        data: body.items.map((item) => ({
          radiologyOrderId: created.id,
          procedureName: item.procedureName,
          bodyPart: item.bodyPart,
          laterality: item.laterality,
          findings: item.findings,
          remarks: item.remarks,
        })),
      });

      return tx.radiologyOrder.findUnique({
        where: {
          id: created.id,
        },
        include: radiologyOrderInclude,
      });
    });

    return success(order);
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Validation failed",
        400
      );
    }

    return failure("Failed to create radiology order", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const query = radiologyOrderListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalIdForUser(
      user,
      query.hospitalId
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    if (!(await ensureHospitalModuleEnabled(hospitalId, "RADIOLOGY"))) {
      return failure("Radiology module is disabled", 403);
    }

    const where: Prisma.RadiologyOrderWhereInput = {
      hospitalId,
      ...(query.patientId
        ? {
            patientId: query.patientId,
          }
        : {}),
      ...(query.opdVisitId
        ? {
            opdVisitId: query.opdVisitId,
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
      ...(query.priority
        ? {
            priority: query.priority,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                orderNo: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                notes: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                items: {
                  some: {
                    procedureName: {
                      contains: query.search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [orders, total] = await prisma.$transaction([
      prisma.radiologyOrder.findMany({
        where,
        include: radiologyOrderInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.limit,
      }),
      prisma.radiologyOrder.count({
        where,
      }),
    ]);

    return success({
      radiologyOrders: orders,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Validation failed",
        400
      );
    }

    return failure("Failed to fetch radiology orders", 500);
  }
}
