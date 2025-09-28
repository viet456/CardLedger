/*
  Warnings:

  - You are about to drop the column `artist` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `rarity` on the `Card` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Card_artist_idx";

-- DropIndex
DROP INDEX "public"."Card_rarity_id_idx";

-- DropIndex
DROP INDEX "public"."card_name_trgm_idx";

-- AlterTable
ALTER TABLE "public"."Card" DROP COLUMN "artist",
DROP COLUMN "rarity",
ADD COLUMN     "artistId" INTEGER,
ADD COLUMN     "rarityId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Rarity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Rarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Artist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rarity_name_key" ON "public"."Rarity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "public"."Artist"("name");

-- CreateIndex
CREATE INDEX "Card_rarityId_id_idx" ON "public"."Card"("rarityId", "id");

-- CreateIndex
CREATE INDEX "Card_artistId_id_idx" ON "public"."Card"("artistId", "id");

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_rarityId_fkey" FOREIGN KEY ("rarityId") REFERENCES "public"."Rarity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "public"."Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
