-- CreateEnum
CREATE TYPE "ConsumptionMode" AS ENUM ('INCOME', 'VARIABLE_BUDGET');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "consumptionMode" "ConsumptionMode" NOT NULL DEFAULT 'INCOME';
