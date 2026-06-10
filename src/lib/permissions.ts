import { prisma } from "@/lib/prisma";

export async function getUserPermissionCodes(
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      userType: true,
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
    return [];
  }

  if (user.userType === "SUPER_ADMIN") {
    const permissions = await prisma.permission.findMany({
      select: {
        code: true,
      },
    });

    return permissions.map((permission) => permission.code);
  }

  const codes = new Set<string>();

  for (const assignment of user.roles) {
    for (const permission of assignment.role.permissions) {
      codes.add(permission.permission.code);
    }
  }

  return [...codes];
}

export async function hasPermission(
  userId: string,
  permissionCode: string
) {
  const permissionCodes = await getUserPermissionCodes(userId);

  return permissionCodes.includes(permissionCode);
}
