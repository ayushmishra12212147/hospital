import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";

export async function requireCurrentUser(
  request: NextRequest
) {
  const currentUser =
    await getCurrentUserFromRequest(request);

  if (!currentUser) {
    return {
      user: null,
      response: failure("Unauthorized", 401),
    };
  }

  return {
    user: currentUser,
    response: null,
  };
}

export function resolveHospitalIdForUser(
  user: {
    userType: string;
    hospitalId: string | null;
  },
  requestedHospitalId?: string
) {
  if (user.userType === "SUPER_ADMIN") {
    return requestedHospitalId ?? null;
  }

  if (
    requestedHospitalId &&
    requestedHospitalId !== user.hospitalId
  ) {
    return null;
  }

  return user.hospitalId;
}

export async function ensureHospitalModuleEnabled(
  hospitalId: string,
  moduleCode: string
) {
  const enabledModule = await prisma.hospitalModule.findFirst({
    where: {
      hospitalId,
      enabled: true,
      module: {
        code: moduleCode,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(enabledModule);
}

export async function requirePermission(
  request: NextRequest,
  permissionCode: string
) {
  const current = await requireCurrentUser(request);

  if (!current.user) {
    return current;
  }

  if (current.user.userType === "SUPER_ADMIN") {
    return current;
  }

  const allowed = await hasPermission(
    current.user.id,
    permissionCode
  );

  if (!allowed) {
    return {
      user: null,
      response: failure("Forbidden", 403),
    };
  }

  return current;
}
