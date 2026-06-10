import { NextRequest } from "next/server";
import { Prisma, BillStatus } from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import {
  billListQuerySchema,
  createBillSchema,
} from "@/lib/validators/billing";

function resolveHospitalId(
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

function nextBillNo(lastBillNo?: string) {
  const lastNumber = lastBillNo
    ? Number(lastBillNo.replace("BIL-", ""))
    : 0;

  return `BIL-${String(lastNumber + 1).padStart(
    6,
    "0"
  )}`;
}

function asDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function deriveBillStatus(
  paidAmount: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
  explicitStatus?: BillStatus
) {
  if (explicitStatus) {
    return explicitStatus;
  }

  if (Number(paidAmount) >= Number(totalAmount)) {
    return "PAID";
  }

  if (Number(paidAmount) > 0) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
}

const billInclude = {
  patient: true,
  opdVisit: {
    include: {
      appointment: true,
    },
  },
  items: true,
  payments: true,
};

export async function POST(
  request: NextRequest
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const body =
      createBillSchema.parse(
        await request.json()
      );

    const hospitalId = resolveHospitalId(
      currentUser,
      body.hospitalId
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const patient =
      await prisma.patient.findFirst({
        where: {
          id: body.patientId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!patient) {
      return failure(
        "Patient not found",
        404
      );
    }

    if (body.opdVisitId) {
      const opdVisit =
        await prisma.opdVisit.findFirst({
          where: {
            id: body.opdVisitId,
            hospitalId,
            patientId: body.patientId,
          },
          select: {
            id: true,
          },
        });

      if (!opdVisit) {
        return failure(
          "OPD visit not found",
          404
        );
      }
    }

    const items = body.items.map((item) => {
      const amount =
        item.quantity * item.unitPrice;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: asDecimal(item.unitPrice),
        amount: asDecimal(amount),
      };
    });

    const subtotalValue = items.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const discountValue = body.discount ?? 0;
    const taxValue = body.tax ?? 0;
    const totalValue =
      subtotalValue - discountValue + taxValue;
    const paidValue = body.paymentAmount ?? 0;
    const balanceValue = Math.max(
      totalValue - paidValue,
      0
    );

    const bill =
      await prisma.$transaction(
        async (tx) => {
          const lastBill =
            await tx.bill.findFirst({
              where: {
                hospitalId,
              },
              orderBy: {
                billNo: "desc",
              },
              select: {
                billNo: true,
              },
            });

          const createdBill =
            await tx.bill.create({
              data: {
                hospitalId,
                patientId: body.patientId,
                opdVisitId: body.opdVisitId,
                billNo: nextBillNo(
                  lastBill?.billNo
                ),
                status: deriveBillStatus(
                  asDecimal(paidValue),
                  asDecimal(totalValue),
                  body.status
                ),
                subtotal: asDecimal(subtotalValue),
                discount: asDecimal(discountValue),
                tax: asDecimal(taxValue),
                totalAmount: asDecimal(totalValue),
                paidAmount: asDecimal(paidValue),
                balanceAmount: asDecimal(
                  balanceValue
                ),
                notes: body.notes,
              },
              include: billInclude,
            });

          await tx.billItem.createMany({
            data: items.map((item) => ({
              ...item,
              billId: createdBill.id,
            })),
          });

          if (
            body.paymentAmount &&
            body.paymentAmount > 0 &&
            body.paymentMethod
          ) {
            await tx.billPayment.create({
              data: {
                billId: createdBill.id,
                amount: asDecimal(
                  body.paymentAmount
                ),
                method: body.paymentMethod,
                referenceNo:
                  body.paymentReferenceNo,
                notes: body.paymentNotes,
              },
            });
          }

          return tx.bill.findUnique({
            where: {
              id: createdBill.id,
            },
            include: billInclude,
          });
        }
      );

    return success(bill);
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
      "Failed to create bill",
      500
    );
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const query =
      billListQuerySchema.parse(
        Object.fromEntries(
          request.nextUrl.searchParams
        )
      );

    const hospitalId = resolveHospitalId(
      currentUser,
      query.hospitalId
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const where = {
      hospitalId,
      ...(query.patientId
        ? {
            patientId: query.patientId,
          }
        : {}),
      ...(query.opdVisitId
        ? {
            opdVisitId: query.opdVisitId,
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                billNo: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                notes: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip =
      (query.page - 1) * query.limit;

    const [bills, total] =
      await prisma.$transaction([
        prisma.bill.findMany({
          where,
          include: billInclude,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: query.limit,
        }),
        prisma.bill.count({
          where,
        }),
      ]);

    return success({
      bills,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(
          total / query.limit
        ),
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
      "Failed to fetch bills",
      500
    );
  }
}
