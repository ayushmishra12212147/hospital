import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import {
  createLabOrderSchema,
  labOrderListQuerySchema,
} from "@/lib/validators/lab";

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

function nextLabOrderNo(lastOrderNo?: string) {
  const lastNumber = lastOrderNo
    ? Number(lastOrderNo.replace("LAB-", ""))
    : 0;

  return `LAB-${String(lastNumber + 1).padStart(6, "0")}`;
}

const labOrderInclude = {
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
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const body = createLabOrderSchema.parse(
      await request.json()
    );

    const hospitalId = resolveHospitalId(
      currentUser,
      body.hospitalId
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
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
      const lastOrder = await tx.labOrder.findFirst({
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

      const created = await tx.labOrder.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          opdVisitId: body.opdVisitId,
          requestedByEmployeeId: body.requestedByEmployeeId,
          orderNo: nextLabOrderNo(lastOrder?.orderNo),
          status: body.status ?? "REQUESTED",
          priority: body.priority ?? "ROUTINE",
          notes: body.notes,
        },
      });

      await tx.labOrderItem.createMany({
        data: body.items.map((item) => ({
          labOrderId: created.id,
          testName: item.testName,
          specimenType: item.specimenType,
          resultValue: item.resultValue,
          unit: item.unit,
          referenceRange: item.referenceRange,
          remarks: item.remarks,
        })),
      });

      return tx.labOrder.findUnique({
        where: {
          id: created.id,
        },
        include: labOrderInclude,
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

    return failure("Failed to create lab order", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const query = labOrderListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const hospitalId = resolveHospitalId(
      currentUser,
      query.hospitalId
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const where: Prisma.LabOrderWhereInput = {
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
                    testName: {
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
      prisma.labOrder.findMany({
        where,
        include: labOrderInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.limit,
      }),
      prisma.labOrder.count({
        where,
      }),
    ]);

    return success({
      labOrders: orders,
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

    return failure("Failed to fetch lab orders", 500);
  }
}
