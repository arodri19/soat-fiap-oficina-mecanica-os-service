-- AlterTable
ALTER TABLE "OrderService" ADD COLUMN     "budgetId" INTEGER;

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
