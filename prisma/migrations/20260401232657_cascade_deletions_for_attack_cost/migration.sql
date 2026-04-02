-- DropForeignKey
ALTER TABLE "AttackCost" DROP CONSTRAINT "AttackCost_attackId_fkey";

-- AddForeignKey
ALTER TABLE "AttackCost" ADD CONSTRAINT "AttackCost_attackId_fkey" FOREIGN KEY ("attackId") REFERENCES "Attack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
