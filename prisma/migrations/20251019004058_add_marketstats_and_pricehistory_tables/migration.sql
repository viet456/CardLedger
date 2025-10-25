/*
  Warnings:

  - You are about to drop the `Price` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Price" DROP CONSTRAINT "Price_cardId_fkey";

-- DropTable
DROP TABLE "public"."Price";

-- CreateTable
CREATE TABLE "public"."MarketStats" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "tcgNearMintLatest" DECIMAL(10,2),
    "tcgLightlyPlayedLatest" DECIMAL(10,2),
    "tcgModeratelyPlayedLatest" DECIMAL(10,2),
    "tcgHeavilyPlayedLatest" DECIMAL(10,2),
    "tcgDamagedLatest" DECIMAL(10,2),
    "tcgNearMintTrend" TEXT,
    "tcgLightlyPlayedTrend" TEXT,
    "tcgModeratelyPlayedTrend" TEXT,
    "tcgHeavilyPlayedTrend" TEXT,
    "tcgDamagedTrend" TEXT,
    "psa8MedianPrice" DECIMAL(10,2),
    "psa8MarketTrend" TEXT,
    "psa8SaleCount" INTEGER,
    "psa9MedianPrice" DECIMAL(10,2),
    "psa9MarketTrend" TEXT,
    "psa9SaleCount" INTEGER,
    "psa10MedianPrice" DECIMAL(10,2),
    "psa10MarketTrend" TEXT,
    "psa10SaleCount" INTEGER,
    "tcgPlayerUpdatedAt" TIMESTAMP(3),
    "ebayLastUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "MarketStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceHistory" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tcgNearMint" DECIMAL(10,2),
    "tcgLightlyPlayed" DECIMAL(10,2),
    "tcgModeratelyPlayed" DECIMAL(10,2),
    "tcgHeavilyPlayed" DECIMAL(10,2),
    "tcgDamaged" DECIMAL(10,2),
    "tcgNearMintVolume" INTEGER,
    "tcgLightlyPlayedVolume" INTEGER,
    "tcgModeratelyPlayedVolume" INTEGER,
    "tcgHeavilyPlayedVolume" INTEGER,
    "tcgDamagedVolume" INTEGER,
    "psa8MedianPrice" DECIMAL(10,2),
    "psa9MedianPrice" DECIMAL(10,2),
    "psa10MedianPrice" DECIMAL(10,2),
    "psa8SaleCount" INTEGER,
    "psa9SaleCount" INTEGER,
    "psa10SaleCount" INTEGER,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketStats_cardId_key" ON "public"."MarketStats"("cardId");

-- CreateIndex
CREATE INDEX "PriceHistory_cardId_timestamp_idx" ON "public"."PriceHistory"("cardId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_cardId_timestamp_key" ON "public"."PriceHistory"("cardId", "timestamp");

-- AddForeignKey
ALTER TABLE "public"."MarketStats" ADD CONSTRAINT "MarketStats_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceHistory" ADD CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
