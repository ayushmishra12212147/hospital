import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const { id: hospitalId } = await params;

    // Tenant Isolation Guard
    if (currentUser.userType !== "SUPER_ADMIN" && currentUser.hospitalId !== hospitalId) {
      return failure("Forbidden", 403);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [
      todayAppointments,
      totalPatients,
      doctorCount,
      totalEmployees,
      todayPayments,
      pendingBillsCount,
    ] = await Promise.all([
      // Today's appointments count
      prisma.appointment.count({
        where: {
          hospitalId,
          appointmentAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
      }),
      // Total patients count
      prisma.patient.count({
        where: { hospitalId },
      }),
      // Doctors count
      prisma.employee.count({
        where: {
          hospitalId,
          designation: {
            contains: "doctor",
            mode: "insensitive",
          },
          isActive: true,
        },
      }),
      // Employees count
      prisma.employee.count({
        where: { hospitalId, isActive: true },
      }),
      // Revenue Today
      prisma.billPayment.aggregate({
        where: {
          bill: { hospitalId },
          paidAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      // Pending bills count
      prisma.bill.count({
        where: {
          hospitalId,
          status: {
            in: ["UNPAID", "PARTIALLY_PAID", "DRAFT"],
          },
        },
      }),
    ]);

    return success({
      todayAppointments,
      totalPatients,
      doctorCount,
      totalEmployees,
      revenueToday: Number(todayPayments._sum.amount ?? 0),
      pendingBillsCount,
    });
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch hospital stats", 500);
  }
}
