import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { createPasswordResetToken, logActivity } from "@/lib/security";

const requestSchema = z.object({
  username: z.string().min(3),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: {
        username: body.username,
      },
    });

    if (!user) {
      return success({
        message: "If the account exists, a reset token is issued.",
      });
    }

    const reset = await createPasswordResetToken(user.id);

    await logActivity({
      hospitalId: user.hospitalId,
      actorUserId: user.id,
      category: "security",
      title: "Password reset requested",
      details: user.username,
    });

    return success({
      message: "Password reset token created",
      resetToken: reset.token,
      expiresAt: reset.expiresAt,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Validation failed",
        400
      );
    }

    return failure("Failed to create password reset token", 500);
  }
}
