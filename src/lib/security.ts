import { randomBytes, createHash } from "crypto";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function generateSecureToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRefreshToken(userId: string) {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 30
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function createPasswordResetToken(userId: string) {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 30
  );

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function logAudit(options: {
  hospitalId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      hospitalId: options.hospitalId ?? null,
      actorUserId: options.actorUserId ?? null,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId ?? null,
      metadata:
        options.metadata === undefined
          ? undefined
          : (options.metadata as Prisma.InputJsonValue),
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    },
  });
}

export async function logActivity(options: {
  hospitalId?: string | null;
  actorUserId?: string | null;
  category: string;
  title: string;
  details?: string | null;
  metadata?: unknown;
}) {
  await prisma.activityLog.create({
    data: {
      hospitalId: options.hospitalId ?? null,
      actorUserId: options.actorUserId ?? null,
      category: options.category,
      title: options.title,
      details: options.details ?? null,
      metadata:
        options.metadata === undefined
          ? undefined
          : (options.metadata as Prisma.InputJsonValue),
    },
  });
}
