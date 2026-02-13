-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LegalityStatus" AS ENUM ('Legal', 'Banned');

-- CreateEnum
CREATE TYPE "CardVariant" AS ENUM ('Normal', 'Holo', 'Reverse', 'FirstEdition');

-- CreateEnum
CREATE TYPE "Supertype" AS ENUM ('Pokémon', 'Trainer', 'Energy');

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Set" (
    "id" TEXT NOT NULL,
    "tcgdexId" TEXT,
    "name" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "seriesId" TEXT,
    "tcgPlayerSetId" TEXT,
    "tcgPlayerNumericId" INTEGER,
    "printedTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "ptcgoCode" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unlimited" "LegalityStatus",
    "standard" "LegalityStatus",
    "expanded" "LegalityStatus",
    "symbolImageKey" TEXT,
    "logoImageKey" TEXT,
    "symbolOptimized" BOOLEAN NOT NULL DEFAULT false,
    "logoOptimized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supertype" "Supertype" NOT NULL,
    "hp" INTEGER,
    "evolvesFrom" TEXT,
    "evolvesTo" TEXT[],
    "convertedRetreatCost" INTEGER,
    "regulationMark" TEXT,
    "description" TEXT,
    "hasNormal" BOOLEAN NOT NULL DEFAULT true,
    "hasHolo" BOOLEAN NOT NULL DEFAULT false,
    "hasReverse" BOOLEAN NOT NULL DEFAULT false,
    "hasFirstEdition" BOOLEAN NOT NULL DEFAULT false,
    "hasWPromo" BOOLEAN NOT NULL DEFAULT false,
    "rules" TEXT[],
    "ancientTraitName" TEXT,
    "ancientTraitText" TEXT,
    "setId" TEXT NOT NULL,
    "rarityId" INTEGER,
    "artistId" INTEGER,
    "number" TEXT NOT NULL,
    "nationalPokedexNumbers" INTEGER[],
    "pokedexNumberSort" INTEGER,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "standard" "LegalityStatus",
    "expanded" "LegalityStatus",
    "unlimited" "LegalityStatus",
    "imageKey" TEXT,
    "imagesOptimized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketStats" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "tcgNearMintLatest" DECIMAL(10,2),
    "tcgNormalLatest" DECIMAL(10,2),
    "tcgReverseLatest" DECIMAL(10,2),
    "tcgHoloLatest" DECIMAL(10,2),
    "tcgFirstEditionLatest" DECIMAL(10,2),
    "tcgPlayerUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "MarketStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tcgNearMint" DECIMAL(10,2),
    "tcgNormal" DECIMAL(10,2),
    "tcgReverse" DECIMAL(10,2),
    "tcgHolo" DECIMAL(10,2),
    "tcgFirstEdition" DECIMAL(10,2),
    "cardId" TEXT NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtype" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subtype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtypesOnCards" (
    "cardId" TEXT NOT NULL,
    "subtypeId" INTEGER NOT NULL,

    CONSTRAINT "SubtypesOnCards_pkey" PRIMARY KEY ("cardId","subtypeId")
);

-- CreateTable
CREATE TABLE "Type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypesOnCards" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "TypesOnCards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attack" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "convertedEnergyCost" INTEGER NOT NULL,
    "damage" TEXT,
    "text" TEXT,

    CONSTRAINT "Attack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackCost" (
    "id" SERIAL NOT NULL,
    "attackId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,

    CONSTRAINT "AttackCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weakness" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "value" TEXT,

    CONSTRAINT "Weakness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resistance" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "value" TEXT,

    CONSTRAINT "Resistance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rarity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Rarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT,
    "displayUsername" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "variant" "CardVariant" NOT NULL DEFAULT 'Normal',

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgdexId_key" ON "Set"("tcgdexId");

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgPlayerSetId_key" ON "Set"("tcgPlayerSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgPlayerNumericId_key" ON "Set"("tcgPlayerNumericId");

-- CreateIndex
CREATE INDEX "Set_name_idx" ON "Set"("name");

-- CreateIndex
CREATE INDEX "Set_series_idx" ON "Set"("series");

-- CreateIndex
CREATE INDEX "Set_releaseDate_idx" ON "Set"("releaseDate");

-- CreateIndex
CREATE INDEX "Card_ancientTraitName_idx" ON "Card"("ancientTraitName");

-- CreateIndex
CREATE INDEX "Card_ancientTraitText_idx" ON "Card"("ancientTraitText");

-- CreateIndex
CREATE INDEX "Card_convertedRetreatCost_id_idx" ON "Card"("convertedRetreatCost", "id");

-- CreateIndex
CREATE INDEX "Card_supertype_id_idx" ON "Card"("supertype", "id");

-- CreateIndex
CREATE INDEX "Card_rarityId_id_idx" ON "Card"("rarityId", "id");

-- CreateIndex
CREATE INDEX "Card_artistId_id_idx" ON "Card"("artistId", "id");

-- CreateIndex
CREATE INDEX "Card_name_setId_idx" ON "Card"("name", "setId");

-- CreateIndex
CREATE INDEX "Card_setId_number_id_idx" ON "Card"("setId", "number", "id");

-- CreateIndex
CREATE INDEX "Card_name_id_idx" ON "Card"("name", "id");

-- CreateIndex
CREATE INDEX "Card_pokedexNumberSort_id_idx" ON "Card"("pokedexNumberSort", "id");

-- CreateIndex
CREATE INDEX "Card_releaseDate_id_idx" ON "Card"("releaseDate", "id");

-- CreateIndex
CREATE INDEX "Card_regulationMark_idx" ON "Card"("regulationMark");

-- CreateIndex
CREATE UNIQUE INDEX "MarketStats_cardId_key" ON "MarketStats"("cardId");

-- CreateIndex
CREATE INDEX "PriceHistory_cardId_timestamp_idx" ON "PriceHistory"("cardId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_cardId_timestamp_key" ON "PriceHistory"("cardId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Subtype_name_key" ON "Subtype"("name");

-- CreateIndex
CREATE INDEX "SubtypesOnCards_subtypeId_idx" ON "SubtypesOnCards"("subtypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Type_name_key" ON "Type"("name");

-- CreateIndex
CREATE INDEX "TypesOnCards_typeId_idx" ON "TypesOnCards"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "TypesOnCards_cardId_typeId_key" ON "TypesOnCards"("cardId", "typeId");

-- CreateIndex
CREATE INDEX "AttackCost_typeId_idx" ON "AttackCost"("typeId");

-- CreateIndex
CREATE INDEX "Weakness_typeId_idx" ON "Weakness"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Weakness_cardId_typeId_key" ON "Weakness"("cardId", "typeId");

-- CreateIndex
CREATE INDEX "Resistance_typeId_idx" ON "Resistance"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Resistance_cardId_typeId_key" ON "Resistance"("cardId", "typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Rarity_name_key" ON "Rarity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "Artist"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "CollectionEntry_userId_idx" ON "CollectionEntry"("userId");

-- CreateIndex
CREATE INDEX "CollectionEntry_cardId_idx" ON "CollectionEntry"("cardId");

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_rarityId_fkey" FOREIGN KEY ("rarityId") REFERENCES "Rarity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStats" ADD CONSTRAINT "MarketStats_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtypesOnCards" ADD CONSTRAINT "SubtypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtypesOnCards" ADD CONSTRAINT "SubtypesOnCards_subtypeId_fkey" FOREIGN KEY ("subtypeId") REFERENCES "Subtype"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypesOnCards" ADD CONSTRAINT "TypesOnCards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypesOnCards" ADD CONSTRAINT "TypesOnCards_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackCost" ADD CONSTRAINT "AttackCost_attackId_fkey" FOREIGN KEY ("attackId") REFERENCES "Attack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackCost" ADD CONSTRAINT "AttackCost_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resistance" ADD CONSTRAINT "Resistance_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resistance" ADD CONSTRAINT "Resistance_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

