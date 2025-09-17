/*
  Warnings:

  - The `evolvesTo` column on the `Card` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Card" DROP COLUMN "evolvesTo",
ADD COLUMN     "evolvesTo" TEXT[];
