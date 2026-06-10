/*
  Warnings:

  - You are about to drop the column `moduleCode` on the `HospitalModule` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hospitalId,moduleId]` on the table `HospitalModule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `moduleId` to the `HospitalModule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "HospitalModule_hospitalId_moduleCode_key";

-- AlterTable
ALTER TABLE "HospitalModule" DROP COLUMN "moduleCode",
ADD COLUMN     "moduleId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_code_key" ON "Module"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalModule_hospitalId_moduleId_key" ON "HospitalModule"("hospitalId", "moduleId");

-- AddForeignKey
ALTER TABLE "HospitalModule" ADD CONSTRAINT "HospitalModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
