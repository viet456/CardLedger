/*
  Warnings:

  - Made the column `releaseDate` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Card" ALTER COLUMN "releaseDate" SET NOT NULL;
