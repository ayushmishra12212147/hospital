import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { generateToken } from "@/lib/jwt";
import { createRefreshToken, hashToken, logActivity } from "@/lib/security";

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = refreshSchema.parse(await request.json());
    const tokenHash = hashToken(body.refreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!storedToken) {
      return failure("Invalid refresh token", 401);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: storedToken.userId,
      },
    });

    if (!user?.isActive) {
      return failure("Invalid refresh token", 401);
    }

    await prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const accessToken = generateToken({
      userId: user.id,
      hospitalId: user.hospitalId,
      userType: user.userType,
      username: user.username,
    });

    const nextRefresh = await createRefreshToken(user.id);

    await logActivity({
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      category: "auth",
      title: "Token refreshed",
      details: user.username,
    });

    return success({
      token: accessToken,
      refreshToken: nextRefresh.token,
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
        hospitalId: user.hospitalId,
        isActive: user.isActive,
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

    return failure("Failed to refresh token", 500);
  }
}
