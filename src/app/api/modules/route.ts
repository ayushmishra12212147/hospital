import { prisma } from "@/lib/prisma";

import {
  success,
  failure,
} from "@/lib/api-response";

export async function GET() {
  try {
    const modules =
      await prisma.module.findMany({
        orderBy: {
          name: "asc",
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