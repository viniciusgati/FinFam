-- CreateEnum
CREATE TYPE "ShoppingItemKind" AS ENUM ('ESSENCIAL', 'DESEJAVEL');

-- CreateTable
CREATE TABLE "shopping_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShoppingItemKind" NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedUnitPriceCents" INTEGER,
    "priceSource" TEXT,
    "priceSampleCount" INTEGER NOT NULL DEFAULT 0,
    "priceFetchedAt" TIMESTAMP(3),
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "addedOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_items_purchased_idx" ON "shopping_items"("purchased");

-- CreateIndex
CREATE INDEX "shopping_items_addedOn_idx" ON "shopping_items"("addedOn");
