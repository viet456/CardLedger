/*
  Warnings:

  - A unique constraint covering the columns `[tcgdexId]` on the table `Set` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "tcgdexId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgdexId_key" ON "Set"("tcgdexId");
