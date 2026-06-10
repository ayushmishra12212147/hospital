-- CreateTable
CREATE TABLE "HospitalModule" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalModule_hospitalId_moduleCode_key" ON "HospitalModule"("hospitalId", "moduleCode");

-- AddForeignKey
ALTER TABLE "HospitalModule" ADD CONSTRAINT "HospitalModule_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
