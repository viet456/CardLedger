-- CreateEnum
CREATE TYPE "public"."LegalityStatus" AS ENUM ('Legal', 'Banned');

-- CreateEnum
CREATE TYPE "public"."Supertype" AS ENUM ('Pokémon', 'Trainer', 'Energy');

-- CreateTable
CREATE TABLE "public"."Set" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "printedTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "ptcgoCode" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unlimited" "public"."LegalityStatus",
    "standard" "public"."LegalityStatus",
    "expanded" "public"."LegalityStatus",
    "symbolImageKey" TEXT,
    "logoImageKey" TEXT,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supertype" "public"."Supertype" NOT NULL,
    "hp" INTEGER,
    "evolvesTo" TEXT[],
    "rules" TEXT[],
    "ancientTraitName" TEXT,
    "ancientTraitText" TEXT,
    "convertedRetreatCost" INTEGER,
    "setId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "artist" TEXT,
    "rarity" TEXT,
    "nationalPokedexNumbers" INTEGER[],
    "unlimited" "public"."LegalityStatus",
    "expanded" "public"."LegalityStatus",

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subtype" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subtype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubtypesOnCards" (
    "cardId" TEXT NOT NULL,
    "subtypeId" INTEGER NOT NULL,

    CONSTRAINT "SubtypesOnCards_pkey" PRIMARY KEY ("cardId","subtypeId")
);

-- CreateTable
CREATE TABLE "public"."Type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TypesOnCards" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "TypesOnCards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attack" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "convertedEnergyCost" INTEGER NOT NULL,
    "damage" TEXT,
    "text" TEXT,

    CONSTRAINT "Attack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttackCost" (
    "id" SERIAL NOT NULL,
    "attackId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "AttackCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Weakness" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "value" TEXT,

    CONSTRAINT "Weakness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RetreatCost" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "RetreatCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Resistance" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "value" TEXT,

    CONSTRAINT "Resistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Set_name_idx" ON "public"."Set"("name");

-- CreateIndex
CREATE INDEX "Set_series_idx" ON "public"."Set"("series");

-- CreateIndex
CREATE INDEX "Set_releaseDate_idx" ON "public"."Set"("releaseDate");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "public"."Card"("name");

-- CreateIndex
CREATE INDEX "Card_supertype_idx" ON "public"."Card"("supertype");

-- CreateIndex
CREATE INDEX "Card_rarity_idx" ON "public"."Card"("rarity");

-- CreateIndex
CREATE INDEX "Card_setId_idx" ON "public"."Card"("setId");

-- CreateIndex
CREATE INDEX "Card_name_setId_idx" ON "public"."Card"("name", "setId");

-- CreateIndex
CREATE UNIQUE INDEX "Subtype_name_key" ON "public"."Subtype"("name");

-- CreateIndex
CREATE INDEX "SubtypesOnCards_subtypeId_idx" ON "public"."SubtypesOnCards"("subtypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Type_name_key" ON "public"."Type"("name");

-- CreateIndex
CREATE INDEX "TypesOnCards_typeId_idx" ON "public"."TypesOnCards"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "TypesOnCards_cardId_typeId_key" ON "public"."TypesOnCards"("cardId", "typeId");

-- CreateIndex
CREATE INDEX "AttackCost_typeId_idx" ON "public"."AttackCost"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Weakness_cardId_typeId_key" ON "public"."Weakness"("cardId", "typeId");

-- CreateIndex
CREATE INDEX "RetreatCost_typeId_idx" ON "public"."RetreatCost"("typeId");

-- CreateIndex
CREATE INDEX "Resistance_typeId_idx" ON "public"."Resistance"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Resistance_cardId_typeId_key" ON "public"."Resistance"("cardId", "typeId");

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "public"."Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubtypesOnCards" ADD CONSTRAINT "SubtypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubtypesOnCards" ADD CONSTRAINT "SubtypesOnCards_subtypeId_fkey" FOREIGN KEY ("subtypeId") REFERENCES "public"."Subtype"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TypesOnCards" ADD CONSTRAINT "TypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TypesOnCards" ADD CONSTRAINT "TypesOnCards_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attack" ADD CONSTRAINT "Attack_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttackCost" ADD CONSTRAINT "AttackCost_attackId_fkey" FOREIGN KEY ("attackId") REFERENCES "public"."Attack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttackCost" ADD CONSTRAINT "AttackCost_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Weakness" ADD CONSTRAINT "Weakness_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Weakness" ADD CONSTRAINT "Weakness_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RetreatCost" ADD CONSTRAINT "RetreatCost_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RetreatCost" ADD CONSTRAINT "RetreatCost_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resistance" ADD CONSTRAINT "Resistance_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resistance" ADD CONSTRAINT "Resistance_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
