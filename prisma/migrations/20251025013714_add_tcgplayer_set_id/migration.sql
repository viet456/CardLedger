/*
  Warnings:

  - You are about to drop the column `marketDataLastFetched` on the `Set` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tcgPlayerSetId]` on the table `Set` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Set" DROP COLUMN "marketDataLastFetched",
ADD COLUMN     "tcgPlayerSetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgPlayerSetId_key" ON "public"."Set"("tcgPlayerSetId");
