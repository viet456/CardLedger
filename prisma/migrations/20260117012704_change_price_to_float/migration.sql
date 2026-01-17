/*
  Warnings:

  - You are about to alter the column `purchasePrice` on the `CollectionEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "CollectionEntry" ALTER COLUMN "purchasePrice" SET DATA TYPE DOUBLE PRECISION;
