-- AlterTable
ALTER TABLE "public"."MarketStats" ADD COLUMN     "tcgDamagedListings" INTEGER,
ADD COLUMN     "tcgHeavilyPlayedListings" INTEGER,
ADD COLUMN     "tcgLightlyPlayedListings" INTEGER,
ADD COLUMN     "tcgModeratelyPlayedListings" INTEGER,
ADD COLUMN     "tcgNearMintListings" INTEGER;
