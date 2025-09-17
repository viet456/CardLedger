/*
  Warnings:

  - You are about to drop the `RetreatCost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."RetreatCost" DROP CONSTRAINT "RetreatCost_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RetreatCost" DROP CONSTRAINT "RetreatCost_typeId_fkey";

-- DropTable
DROP TABLE "public"."RetreatCost";
