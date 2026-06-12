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

    const search = request.nextUrl.searchParams.get("search") || "";
    const pageStr = request.nextUrl.searchParams.get("page");
    const limitStr = request.nextUrl.searchParams.get("limit");

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { subdomain: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    if (pageStr && limitStr) {
      const page = Number(pageStr) || 1;
      const limit = Number(limitStr) || 10;
      const skip = (page - 1) * limit;

      const [hospitals, total] = await prisma.$transaction([
        prisma.hospital.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.hospital.count({ where }),
      ]);

      return success({
        hospitals,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });
    }

    const hospitals = await prisma.hospital.findMany({
      where,
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
