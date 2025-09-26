-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "pokedexNumberSort" INTEGER;

-- CreateIndex
CREATE INDEX "Card_number_id_idx" ON "public"."Card"("number", "id");

-- CreateIndex
CREATE INDEX "Card_pokedexNumberSort_id_idx" ON "public"."Card"("pokedexNumberSort", "id");
