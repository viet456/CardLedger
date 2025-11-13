-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "imagesOptimized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Set" ADD COLUMN     "logoOptimized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "symbolOptimized" BOOLEAN NOT NULL DEFAULT false;
