-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ATTENDANT', 'MECHANIC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPF" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cep" TEXT NOT NULL,

    CONSTRAINT "ClientPF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPJ" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fantasyName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "legalResponsible" TEXT NOT NULL,

    CONSTRAINT "ClientPJ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "clientPFId" INTEGER NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slaMinutes" INTEGER NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderService" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEBIDA',
    "description" TEXT NOT NULL,
    "mechanicName" TEXT,
    "budgetValue" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientPFId" INTEGER,
    "clientPJId" INTEGER,
    "vehicleId" INTEGER NOT NULL,

    CONSTRAINT "OrderService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderServiceService" (
    "id" SERIAL NOT NULL,
    "orderServiceId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderServiceService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderServicePart" (
    "id" SERIAL NOT NULL,
    "orderServiceId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderServicePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPF_cpf_key" ON "ClientPF"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPJ_cnpj_key" ON "ClientPJ"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientPFId_fkey" FOREIGN KEY ("clientPFId") REFERENCES "ClientPF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_clientPFId_fkey" FOREIGN KEY ("clientPFId") REFERENCES "ClientPF"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_clientPJId_fkey" FOREIGN KEY ("clientPJId") REFERENCES "ClientPJ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServiceService" ADD CONSTRAINT "OrderServiceService_orderServiceId_fkey" FOREIGN KEY ("orderServiceId") REFERENCES "OrderService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServiceService" ADD CONSTRAINT "OrderServiceService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServicePart" ADD CONSTRAINT "OrderServicePart_orderServiceId_fkey" FOREIGN KEY ("orderServiceId") REFERENCES "OrderService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServicePart" ADD CONSTRAINT "OrderServicePart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
