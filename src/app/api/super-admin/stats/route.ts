import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser || currentUser.userType !== "SUPER_ADMIN") {
      return failure("Forbidden", 403);
    }

    const [
      totalHospitals,
      activeHospitals,
      disabledHospitals,
      totalUsers,
      totalPatients,
      totalAppointments,
      recentHospitals,
      recentUsers,
    ] = await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.count({ where: { status: true } }),
      prisma.hospital.count({ where: { status: false } }),
      prisma.user.count(),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.hospital.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        where: {
          userType: "HOSPITAL_USER",
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          employee: true,
          hospital: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return success({
      stats: {
        totalHospitals,
        activeHospitals,
        disabledHospitals,
        totalUsers,
        totalPatients,
        totalAppointments,
      },
      recentHospitals,
      recentAdmins: recentUsers.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.employee?.fullName ?? "No Employee Profile",
        hospitalName: u.hospital?.name ?? "No Hospital Linked",
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch Super Admin stats", 500);
  }
}
