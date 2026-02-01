-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "description" TEXT,
ADD COLUMN     "hasFirstEdition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasHolo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasNormal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasReverse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasWPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regulationMark" TEXT;

-- CreateIndex
CREATE INDEX "Card_regulationMark_idx" ON "Card"("regulationMark");
