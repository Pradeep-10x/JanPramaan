-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IssueStatus" ADD VALUE 'INSPECTING';
ALTER TYPE "IssueStatus" ADD VALUE 'CONTRACTOR_ASSIGNED';
ALTER TYPE "IssueStatus" ADD VALUE 'WORK_DONE';
ALTER TYPE "IssueStatus" ADD VALUE 'UNDER_REVIEW';

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "contractorId" TEXT,
ADD COLUMN     "inspectorId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_inspectorId_idx" ON "Issue"("inspectorId");

-- CreateIndex
CREATE INDEX "Issue_contractorId_idx" ON "Issue"("contractorId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
