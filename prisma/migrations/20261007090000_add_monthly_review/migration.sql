-- CreateTable
CREATE TABLE "monthly_reviews" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reviews_monthKey_key" ON "monthly_reviews"("monthKey");
