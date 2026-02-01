-- DropForeignKey
ALTER TABLE "Ability" DROP CONSTRAINT "Ability_cardId_fkey";

-- DropForeignKey
ALTER TABLE "Attack" DROP CONSTRAINT "Attack_cardId_fkey";

-- DropForeignKey
ALTER TABLE "Resistance" DROP CONSTRAINT "Resistance_cardId_fkey";

-- DropForeignKey
ALTER TABLE "SubtypesOnCards" DROP CONSTRAINT "SubtypesOnCards_cardId_fkey";

-- DropForeignKey
ALTER TABLE "TypesOnCards" DROP CONSTRAINT "TypesOnCards_cardId_fkey";

-- DropForeignKey
ALTER TABLE "Weakness" DROP CONSTRAINT "Weakness_cardId_fkey";

-- AddForeignKey
ALTER TABLE "SubtypesOnCards" ADD CONSTRAINT "SubtypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypesOnCards" ADD CONSTRAINT "TypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resistance" ADD CONSTRAINT "Resistance_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
