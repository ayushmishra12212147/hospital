import { NextRequest } from "next/server";
import { Prisma, BillStatus } from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  success,
  failure,
} from "@/lib/api-response";
import { getCurrentUserFromRequest } from "@/lib/current-user";
import { updateBillSchema } from "@/lib/validators/billing";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get(
        "hospitalId"
      ) ?? undefined
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const { id } = await params;

    const bill = await prisma.bill.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: billInclude,
    });

    if (!bill) {
      return failure("Bill not found", 404);
    }

    return success(bill);
  } catch (error) {
    console.error(error);

    return failure(
      "Failed to fetch bill",
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser =
      await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return failure("Unauthorized", 401);
    }

    const hospitalId = resolveHospitalId(
      currentUser,
      request.nextUrl.searchParams.get(
        "hospitalId"
      ) ?? undefined
    );

    if (!hospitalId) {
      return failure(
        "Hospital is required",
        400
      );
    }

    const { id } = await params;
    const body =
      updateBillSchema.parse(
        await request.json()
      );

    const existingBill =
      await prisma.bill.findFirst({
        where: {
          id,
          hospitalId,
        },
        select: {
          id: true,
          subtotal: true,
          discount: true,
          tax: true,
          totalAmount: true,
          paidAmount: true,
        },
      });

    if (!existingBill) {
      return failure("Bill not found", 404);
    }

    const bill = await prisma.$transaction(
      async (tx) => {
        let subtotal = Number(
          existingBill.subtotal
        );
        let discount = Number(
          existingBill.discount
        );
        let tax = Number(existingBill.tax);
        let paidAmount = Number(
          existingBill.paidAmount
        );

        if (body.items) {
          await tx.billItem.deleteMany({
            where: {
              billId: id,
            },
          });

          const nextItems = body.items.map(
            (item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: asDecimal(item.unitPrice),
              amount: asDecimal(
                item.quantity * item.unitPrice
              ),
            })
          );

          subtotal = nextItems.reduce(
            (sum, item) => sum + Number(item.amount),
            0
          );

          await tx.billItem.createMany({
            data: nextItems.map((item) => ({
              ...item,
              billId: id,
            })),
          });
        }

        if (body.discount !== undefined) {
          discount = body.discount;
        }

        if (body.tax !== undefined) {
          tax = body.tax;
        }

        if (
          body.paymentAmount &&
          body.paymentAmount > 0 &&
          body.paymentMethod
        ) {
          await tx.billPayment.create({
            data: {
              billId: id,
              amount: asDecimal(body.paymentAmount),
              method: body.paymentMethod,
              referenceNo: body.paymentReferenceNo,
              notes: body.paymentNotes,
            },
          });

          paidAmount += body.paymentAmount;
        }

        const totalAmount =
          subtotal - discount + tax;
        const balanceAmount = Math.max(
          totalAmount - paidAmount,
          0
        );

        return tx.bill.update({
          where: { id },
          data: {
            notes: body.notes,
            discount: asDecimal(discount),
            tax: asDecimal(tax),
            subtotal: asDecimal(subtotal),
            totalAmount: asDecimal(totalAmount),
            paidAmount: asDecimal(paidAmount),
            balanceAmount: asDecimal(balanceAmount),
            status: deriveBillStatus(
              asDecimal(paidAmount),
              asDecimal(totalAmount),
              body.status
            ),
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
      "Failed to update bill",
      500
    );
  }
}
