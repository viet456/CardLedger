-- CreateTable
CREATE TABLE "public"."Price" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Price_cardId_idx" ON "public"."Price"("cardId");

-- AddForeignKey
ALTER TABLE "public"."Price" ADD CONSTRAINT "Price_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
