/*
  Warnings:

  - You are about to drop the column `yearsCount` on the `departments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "subjects_libraryId_departmentId_yearLevel_idx";

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "yearsCount";

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "academicYearId" TEXT;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "academicYearId" TEXT,
ALTER COLUMN "yearLevel" DROP NOT NULL;

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearOrder" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_libraryId_departmentId_idx" ON "academic_years"("libraryId", "departmentId");

-- CreateIndex
CREATE INDEX "students_libraryId_departmentId_academicYearId_idx" ON "students"("libraryId", "departmentId", "academicYearId");

-- CreateIndex
CREATE INDEX "subjects_libraryId_departmentId_academicYearId_idx" ON "subjects"("libraryId", "departmentId", "academicYearId");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
