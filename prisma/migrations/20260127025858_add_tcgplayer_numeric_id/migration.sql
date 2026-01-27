/*
  Warnings:

  - A unique constraint covering the columns `[tcgPlayerNumericId]` on the table `Set` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "tcgPlayerNumericId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgPlayerNumericId_key" ON "Set"("tcgPlayerNumericId");
