import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { updateLabOrderSchema } from "@/lib/validators/lab";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get("hospitalId") ?? undefined
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const { id } = await params;

    const order = await prisma.labOrder.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: labOrderInclude,
    });

    if (!order) {
      return failure("Lab order not found", 404);
    }

    return success(order);
  } catch (error) {
    console.error(error);

    return failure("Failed to fetch lab order", 500);
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

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get("hospitalId") ?? undefined
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    const { id } = await params;
    const body = updateLabOrderSchema.parse(await request.json());

    const existing = await prisma.labOrder.findFirst({
      where: {
        id,
        hospitalId,
      },
      select: {
        id: true,
        hospitalId: true,
      },
    });

    if (!existing) {
      return failure("Lab order not found", 404);
    }

    const order = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.labOrderItem.deleteMany({
          where: {
            labOrderId: id,
          },
        });

        await tx.labOrderItem.createMany({
          data: body.items.map((item) => ({
            labOrderId: id,
            testName: item.testName,
            specimenType: item.specimenType,
            resultValue: item.resultValue,
            unit: item.unit,
            referenceRange: item.referenceRange,
            remarks: item.remarks,
          })),
        });
      }

      return tx.labOrder.update({
        where: {
          id,
        },
        data: {
          notes: body.notes,
          status: body.status,
          priority: body.priority,
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

    return failure("Failed to update lab order", 500);
  }
}
