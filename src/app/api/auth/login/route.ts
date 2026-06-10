import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { generateToken } from "@/lib/jwt";
import { createRefreshToken, logActivity } from "@/lib/security";

import { loginSchema } from "@/lib/validators/auth";
import { success, failure } from "@/lib/api-response";

export async function POST(
  request: NextRequest
) {
  try {
    const body = loginSchema.parse(
      await request.json()
    );

    const { username, password } = body;

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (!user) {
      return failure(
        "Invalid username or password",
        401
      );
    }

    if (!user.isActive) {
      return failure(
        "Account is disabled",
        403
      );
    }

    const passwordMatch =
      await comparePassword(
        password,
        user.password
      );

    if (!passwordMatch) {
      return failure(
        "Invalid username or password",
        401
      );
    }

    const token = generateToken({
      userId: user.id,
      hospitalId: user.hospitalId,
      userType: user.userType,
      username: user.username,
    });
    const refreshToken = await createRefreshToken(user.id);

    await logActivity({
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      category: "auth",
      title: "User logged in",
      details: user.username,
    });

    return success({
      token,
      refreshToken: refreshToken.token,
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
        error.issues[0]?.message ??
          "Validation failed",
        400
      );
    }

    return failure(
      "Internal server error",
      500
    );
  }
}
