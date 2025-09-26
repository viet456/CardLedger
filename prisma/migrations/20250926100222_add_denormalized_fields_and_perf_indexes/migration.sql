-- DropIndex
DROP INDEX "public"."Card_name_idx";

-- DropIndex
DROP INDEX "public"."Card_number_id_idx";

-- DropIndex
DROP INDEX "public"."Card_rarity_idx";

-- DropIndex
DROP INDEX "public"."Card_setId_idx";

-- DropIndex
DROP INDEX "public"."Card_supertype_idx";

-- CreateIndex
CREATE INDEX "Card_artist_idx" ON "public"."Card"("artist");

-- CreateIndex
CREATE INDEX "Card_ancientTraitName_idx" ON "public"."Card"("ancientTraitName");

-- CreateIndex
CREATE INDEX "Card_ancientTraitText_idx" ON "public"."Card"("ancientTraitText");

-- CreateIndex
CREATE INDEX "Card_convertedRetreatCost_id_idx" ON "public"."Card"("convertedRetreatCost", "id");

-- CreateIndex
CREATE INDEX "Weakness_typeId_idx" ON "public"."Weakness"("typeId");
