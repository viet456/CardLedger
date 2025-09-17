-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "evolvesFrom" TEXT,
ALTER COLUMN "evolvesTo" DROP NOT NULL,
ALTER COLUMN "evolvesTo" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "public"."Ability" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Ability" ADD CONSTRAINT "Ability_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
