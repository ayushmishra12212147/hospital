import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";

import {
  success,
  failure,
} from "@/lib/api-response";
import { requirePermission } from "@/lib/tenant-guards";

import {
  createHospitalSchema,
} from "@/lib/validators/hospital";

export async function POST(
  request: NextRequest
) {
  try {
    const { user, response } = await requirePermission(
      request,
      "hospital.create"
    );

    if (!user) {
      return response;
    }

    const body =
      createHospitalSchema.parse(
        await request.json()
      );

    const {
      name,
      subdomain,
    } = body;

    const existingHospital =
      await prisma.hospital.findUnique({
        where: {
          subdomain,
        },
      });

    if (existingHospital) {
      return failure(
        "Subdomain already exists",
        409
      );
    }

    const hospital =
      await prisma.hospital.create({
        data: {
          name,
          subdomain,
        },
      });

    return success(hospital);

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
      "Failed to create hospital",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requirePermission(
      request,
      "hospital.view"
    );

    if (!user) {
      return response;
    }

    const hospitals =
      await prisma.hospital.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    return success(hospitals);

  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch hospitals",
      500
    );
  }
}
