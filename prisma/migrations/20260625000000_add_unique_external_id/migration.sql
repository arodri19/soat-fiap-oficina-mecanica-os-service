-- AlterTable: add unique constraint to OrderService.externalId
CREATE UNIQUE INDEX "OrderService_externalId_key" ON "OrderService"("externalId");
