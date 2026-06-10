import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function getCurrentUser(token: string) {
  try {
    const decoded = verifyToken(token) as {
      userId: string;
    };

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    if (!user?.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(
  request: NextRequest
) {
  const authHeader =
    request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace(
    "Bearer ",
    ""
  );

  return getCurrentUser(token);
}
