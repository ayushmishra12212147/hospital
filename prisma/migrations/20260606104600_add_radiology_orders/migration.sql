-- CreateEnum
CREATE TYPE "RadiologyOrderStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RadiologyOrder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "opdVisitId" TEXT,
    "requestedByEmployeeId" TEXT,
    "orderNo" TEXT NOT NULL,
    "status" "RadiologyOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "priority" "LabPriority" NOT NULL DEFAULT 'ROUTINE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyOrderItem" (
    "id" TEXT NOT NULL,
    "radiologyOrderId" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "bodyPart" TEXT,
    "laterality" TEXT,
    "findings" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadiologyOrder_hospitalId_idx" ON "RadiologyOrder"("hospitalId");

-- CreateIndex
CREATE INDEX "RadiologyOrder_patientId_idx" ON "RadiologyOrder"("patientId");

-- CreateIndex
CREATE INDEX "RadiologyOrder_opdVisitId_idx" ON "RadiologyOrder"("opdVisitId");

-- CreateIndex
CREATE INDEX "RadiologyOrder_requestedByEmployeeId_idx" ON "RadiologyOrder"("requestedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologyOrder_hospitalId_orderNo_key" ON "RadiologyOrder"("hospitalId", "orderNo");

-- CreateIndex
CREATE INDEX "RadiologyOrderItem_radiologyOrderId_idx" ON "RadiologyOrderItem"("radiologyOrderId");

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_opdVisitId_fkey" FOREIGN KEY ("opdVisitId") REFERENCES "OpdVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_requestedByEmployeeId_fkey" FOREIGN KEY ("requestedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrderItem" ADD CONSTRAINT "RadiologyOrderItem_radiologyOrderId_fkey" FOREIGN KEY ("radiologyOrderId") REFERENCES "RadiologyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
