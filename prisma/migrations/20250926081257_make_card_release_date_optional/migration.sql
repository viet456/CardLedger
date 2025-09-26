-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "releaseDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Card_name_id_idx" ON "public"."Card"("name", "id");

-- CreateIndex
CREATE INDEX "Card_setId_number_id_idx" ON "public"."Card"("setId", "number", "id");

-- CreateIndex
CREATE INDEX "Card_rarity_id_idx" ON "public"."Card"("rarity", "id");

-- CreateIndex
CREATE INDEX "Card_supertype_id_idx" ON "public"."Card"("supertype", "id");

-- CreateIndex
CREATE INDEX "Card_releaseDate_id_idx" ON "public"."Card"("releaseDate", "id");
