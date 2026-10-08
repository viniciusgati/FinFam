-- AlterTable
ALTER TABLE "monthly_snapshots" ADD COLUMN     "fixedIncomeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "obligationDailyCents" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "variableDailyCents" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "variableIncomeCents" INTEGER NOT NULL DEFAULT 0;
