-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT', 'PIX', 'CREDIT');

-- CreateTable
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receiveDay" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startMonth" TEXT,
    "endMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startMonth" TEXT,
    "endMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limitCents" INTEGER,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable_expenses" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "creditCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variable_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchases" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "installmentNumber" INTEGER NOT NULL DEFAULT 1,
    "installmentsTotal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_snapshots" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "incomeCents" INTEGER NOT NULL,
    "fixedExpensesCents" INTEGER NOT NULL,
    "variableExpensesCents" INTEGER NOT NULL,
    "cardExpensesCents" INTEGER NOT NULL,
    "consumedCents" INTEGER NOT NULL,
    "consumedPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variable_expenses_date_idx" ON "variable_expenses"("date");

-- CreateIndex
CREATE INDEX "card_purchases_purchaseDate_idx" ON "card_purchases"("purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_snapshots_monthKey_key" ON "monthly_snapshots"("monthKey");

-- AddForeignKey
ALTER TABLE "variable_expenses" ADD CONSTRAINT "variable_expenses_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
