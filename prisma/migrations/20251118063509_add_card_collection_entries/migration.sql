-- CreateEnum
CREATE TYPE "public"."CardCondition" AS ENUM ('tcgNearMint', 'tcgLightlyPlayed', 'tcgModeratelyPlayed', 'tcgHeavilyPlayed', 'tcgDamaged', 'psa10', 'psa9', 'psa8');

-- CreateTable
CREATE TABLE "public"."CollectionEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "condition" "public"."CardCondition" NOT NULL DEFAULT 'tcgNearMint',
    "variantName" TEXT,

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionEntry_userId_idx" ON "public"."CollectionEntry"("userId");

-- CreateIndex
CREATE INDEX "CollectionEntry_cardId_idx" ON "public"."CollectionEntry"("cardId");

-- AddForeignKey
ALTER TABLE "public"."CollectionEntry" ADD CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionEntry" ADD CONSTRAINT "CollectionEntry_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
