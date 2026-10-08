-- AlterTable
ALTER TABLE "monthly_snapshots" ADD COLUMN     "consumptionAvailableCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyAverageCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "daysInMonth" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "monthly_category_snapshots" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_category_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_category_snapshots_monthKey_idx" ON "monthly_category_snapshots"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_category_snapshots_monthKey_categoryKey_key" ON "monthly_category_snapshots"("monthKey", "categoryKey");

-- AddForeignKey
ALTER TABLE "monthly_category_snapshots" ADD CONSTRAINT "monthly_category_snapshots_monthKey_fkey" FOREIGN KEY ("monthKey") REFERENCES "monthly_snapshots"("monthKey") ON DELETE CASCADE ON UPDATE CASCADE;
