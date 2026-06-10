import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import {
  ensureHospitalModuleEnabled,
  requireCurrentUser,
  resolveHospitalIdForUser,
} from "@/lib/tenant-guards";
import { updateRadiologyOrderSchema } from "@/lib/validators/radiology";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const hospitalId = resolveHospitalIdForUser(
      user,
      request.nextUrl.searchParams.get("hospitalId") ?? undefined
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    if (!(await ensureHospitalModuleEnabled(hospitalId, "RADIOLOGY"))) {
      return failure("Radiology module is disabled", 403);
    }

    const { id } = await params;

    const order = await prisma.radiologyOrder.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: radiologyOrderInclude,
    });

    if (!order) {
      return failure("Radiology order not found", 404);
    }

    return success(order);
  } catch (error) {
    console.error(error);

    return failure("Failed to fetch radiology order", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const hospitalId = resolveHospitalIdForUser(
      user,
      request.nextUrl.searchParams.get("hospitalId") ?? undefined
    );

    if (!hospitalId) {
      return failure("Hospital is required", 400);
    }

    if (!(await ensureHospitalModuleEnabled(hospitalId, "RADIOLOGY"))) {
      return failure("Radiology module is disabled", 403);
    }

    const { id } = await params;
    const body = updateRadiologyOrderSchema.parse(
      await request.json()
    );

    const existing = await prisma.radiologyOrder.findFirst({
      where: {
        id,
        hospitalId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return failure("Radiology order not found", 404);
    }

    const order = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.radiologyOrderItem.deleteMany({
          where: {
            radiologyOrderId: id,
          },
        });

        await tx.radiologyOrderItem.createMany({
          data: body.items.map((item) => ({
            radiologyOrderId: id,
            procedureName: item.procedureName,
            bodyPart: item.bodyPart,
            laterality: item.laterality,
            findings: item.findings,
            remarks: item.remarks,
          })),
        });
      }

      return tx.radiologyOrder.update({
        where: {
          id,
        },
        data: {
          notes: body.notes,
          status: body.status,
          priority: body.priority,
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

    return failure("Failed to update radiology order", 500);
  }
}
