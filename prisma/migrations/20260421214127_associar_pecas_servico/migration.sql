/*
  Warnings:

  - You are about to drop the `OrderServicePart` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrderServicePart" DROP CONSTRAINT "OrderServicePart_orderServiceId_fkey";

-- DropForeignKey
ALTER TABLE "OrderServicePart" DROP CONSTRAINT "OrderServicePart_partId_fkey";

-- DropForeignKey
ALTER TABLE "OrderServiceService" DROP CONSTRAINT "OrderServiceService_orderServiceId_fkey";

-- DropTable
DROP TABLE "OrderServicePart";

-- CreateTable
CREATE TABLE "OrderServiceServicePart" (
    "id" SERIAL NOT NULL,
    "orderServiceServiceId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderServiceServicePart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderServiceService" ADD CONSTRAINT "OrderServiceService_orderServiceId_fkey" FOREIGN KEY ("orderServiceId") REFERENCES "OrderService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServiceServicePart" ADD CONSTRAINT "OrderServiceServicePart_orderServiceServiceId_fkey" FOREIGN KEY ("orderServiceServiceId") REFERENCES "OrderServiceService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServiceServicePart" ADD CONSTRAINT "OrderServiceServicePart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
