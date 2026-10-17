-- Fase 4: orçamento e pagamento migram para o billing-service (banco próprio).
-- O "budgetId" da OS passa a ser só a referência (uuid) do orçamento remoto — os
-- ids inteiros antigos apontavam para a tabela local "Budget", removida aqui.
-- Também cria as tabelas da saga orquestrada (SagaInstance/SagaEvent), do
-- Transactional Outbox, do Inbox (idempotência) e do histórico de status.

-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'AGUARDANDO_PAGAMENTO';
ALTER TYPE "OrderStatus" ADD VALUE 'AGUARDANDO_EXECUCAO';
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELADA';

-- DropForeignKey
ALTER TABLE "OrderService" DROP CONSTRAINT "OrderService_budgetId_fkey";

-- Os ids antigos não têm correspondência no billing-service
UPDATE "OrderService" SET "budgetId" = NULL;

-- AlterTable
ALTER TABLE "OrderService" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "budgetId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OrderServiceService" ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderServiceServicePart" ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Budget";

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SagaInstance" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SagaStatus" NOT NULL,
    "currentStep" TEXT NOT NULL,
    "budgetId" TEXT,
    "paymentId" TEXT,
    "paymentUrl" TEXT,
    "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "executionQueued" BOOLEAN NOT NULL DEFAULT false,
    "executionTerminal" BOOLEAN NOT NULL DEFAULT false,
    "pendingCompensations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failureReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "stepStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SagaInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SagaEvent" (
    "id" SERIAL NOT NULL,
    "sagaId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SagaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SagaInstance_orderId_key" ON "SagaInstance"("orderId");

-- CreateIndex
CREATE INDEX "SagaInstance_status_currentStep_stepStartedAt_idx" ON "SagaInstance"("status", "currentStep", "stepStartedAt");

-- CreateIndex
CREATE INDEX "SagaEvent_sagaId_idx" ON "SagaEvent"("sagaId");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_createdAt_idx" ON "OutboxMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SagaInstance" ADD CONSTRAINT "SagaInstance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SagaEvent" ADD CONSTRAINT "SagaEvent_sagaId_fkey" FOREIGN KEY ("sagaId") REFERENCES "SagaInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

