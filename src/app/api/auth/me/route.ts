import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import {
  success,
  failure,
} from "@/lib/api-response";

export async function GET(
  request: NextRequest
) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (!authHeader) {
      return failure(
        "No token provided",
        401
      );
    }

    const token = authHeader.replace(
      "Bearer ",
      ""
    );

    let decoded: any;
    try {
      decoded = verifyToken(token);
    } catch {
      return failure(
        "Invalid token",
        401
      );
    }

    if (!decoded || !decoded.userId) {
      return failure(
        "Invalid token",
        401
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      include: {
        employee: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return failure(
        "User not found",
        404
      );
    }

    if (!user.isActive) {
      return failure(
        "Account is disabled",
        403
      );
    }

    return success({
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
        hospitalId: user.hospitalId,
        isActive: user.isActive,
        employee: user.employee,
        roles: user.roles.map((ur) => ({
          roleId: ur.roleId,
          name: ur.role.name,
          permissions: ur.role.permissions.map((rp) => rp.permission.code),
        })),
      },
    });

  } catch (error) {
    console.error(error);

    return failure(
      "Internal server error",
      500
    );
  }
}