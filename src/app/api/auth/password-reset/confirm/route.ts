import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { hashToken, logActivity } from "@/lib/security";

const confirmSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = confirmSchema.parse(await request.json());
    const tokenHash = hashToken(body.token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetToken) {
      return failure("Invalid reset token", 400);
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          password: hashedPassword,
        },
      });

      await tx.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      });
    });

    const user = await prisma.user.findUnique({
      where: {
        id: resetToken.userId,
      },
    });

    await logActivity({
      hospitalId: user?.hospitalId ?? null,
      actorUserId: user?.id ?? null,
      category: "security",
      title: "Password reset completed",
      details: user?.username ?? null,
    });

    return success({
      message: "Password updated",
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Validation failed",
        400
      );
    }

    return failure("Failed to reset password", 500);
  }
}
