import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { success, failure } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const permissions = await prisma.permission.findMany({
      orderBy: {
        code: "asc",
      },
    });

    return success(permissions);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch permissions", 500);
  }
}
