import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  success,
  failure,
} from "@/lib/api-response";
import { requirePermission, requireCurrentUser } from "@/lib/tenant-guards";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requirePermission(
      request,
      "module.enable"
    );

    if (!user) {
      return response;
    }

    const { id } = await params;

    const body =
      await request.json();

    const { moduleIds } = body;

    for (const moduleId of moduleIds) {
      await prisma.hospitalModule.upsert({
        where: {
          hospitalId_moduleId: {
            hospitalId: id,
            moduleId,
          },
        },
        update: {
          enabled: true,
        },
        create: {
          hospitalId: id,
          moduleId,
          enabled: true,
        },
      });
    }

    return success({
      message: "Modules assigned",
    });

  } catch (error) {
    console.error(error);

    return failure(
      "Failed to assign modules",
      500
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireCurrentUser(request);

    if (!user) {
      return response;
    }

    const { id } = await params;

    if (user.userType !== "SUPER_ADMIN" && user.hospitalId !== id) {
      return failure("Forbidden", 403);
    }

    const modules =
      await prisma.hospitalModule.findMany({
        where: {
          hospitalId: id,
        },
        include: {
          module: true,
        },
      });

    return success(modules);

  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch modules",
      500
    );
  }
}
