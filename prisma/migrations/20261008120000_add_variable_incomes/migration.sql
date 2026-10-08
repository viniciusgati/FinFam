-- CreateTable
CREATE TABLE "variable_incomes" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variable_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variable_incomes_date_idx" ON "variable_incomes"("date");
