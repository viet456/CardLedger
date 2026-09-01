-- AlterTable: Increase purchasePrice precision from Decimal(10,2) to Decimal(12,6)
-- for accurate currency conversions (especially zero-decimal currencies like JPY/KRW)
ALTER TABLE "CollectionEntry" ALTER COLUMN "purchasePrice" SET DATA TYPE DECIMAL(12, 6);
