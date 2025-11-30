/*
  Warnings:

  - The values [psa10,psa9,psa8] on the enum `CardCondition` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `ebayLastUpdatedAt` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa10MarketTrend` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa10MedianPrice` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa10SaleCount` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa8MarketTrend` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa8MedianPrice` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa8SaleCount` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa9MarketTrend` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa9MedianPrice` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa9SaleCount` on the `MarketStats` table. All the data in the column will be lost.
  - You are about to drop the column `psa10MedianPrice` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `psa10SaleCount` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `psa8MedianPrice` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `psa8SaleCount` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `psa9MedianPrice` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `psa9SaleCount` on the `PriceHistory` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CardCondition_new" AS ENUM ('tcgNearMint', 'tcgLightlyPlayed', 'tcgModeratelyPlayed', 'tcgHeavilyPlayed', 'tcgDamaged');
ALTER TABLE "public"."CollectionEntry" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TABLE "CollectionEntry" ALTER COLUMN "condition" TYPE "CardCondition_new" USING ("condition"::text::"CardCondition_new");
ALTER TYPE "CardCondition" RENAME TO "CardCondition_old";
ALTER TYPE "CardCondition_new" RENAME TO "CardCondition";
DROP TYPE "public"."CardCondition_old";
ALTER TABLE "CollectionEntry" ALTER COLUMN "condition" SET DEFAULT 'tcgNearMint';
COMMIT;

-- AlterTable
ALTER TABLE "MarketStats" DROP COLUMN "ebayLastUpdatedAt",
DROP COLUMN "psa10MarketTrend",
DROP COLUMN "psa10MedianPrice",
DROP COLUMN "psa10SaleCount",
DROP COLUMN "psa8MarketTrend",
DROP COLUMN "psa8MedianPrice",
DROP COLUMN "psa8SaleCount",
DROP COLUMN "psa9MarketTrend",
DROP COLUMN "psa9MedianPrice",
DROP COLUMN "psa9SaleCount";

-- AlterTable
ALTER TABLE "PriceHistory" DROP COLUMN "psa10MedianPrice",
DROP COLUMN "psa10SaleCount",
DROP COLUMN "psa8MedianPrice",
DROP COLUMN "psa8SaleCount",
DROP COLUMN "psa9MedianPrice",
DROP COLUMN "psa9SaleCount";
