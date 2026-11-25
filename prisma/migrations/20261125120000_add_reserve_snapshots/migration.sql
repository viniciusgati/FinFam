-- CreateTable
CREATE TABLE "reserve_snapshots" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserve_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reserve_snapshots_monthKey_key" ON "reserve_snapshots"("monthKey");
