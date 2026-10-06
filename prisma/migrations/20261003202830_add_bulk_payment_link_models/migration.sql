/*
  Warnings:

  - You are about to drop the `Test` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- DropTable
DROP TABLE "Test";

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "successfulRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paymentlink" (
    "id" TEXT NOT NULL,
    "bulkJobId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "paymentUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paymentlink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkJob_merchantId_idx" ON "BulkJob"("merchantId");

-- CreateIndex
CREATE INDEX "BulkJob_status_idx" ON "BulkJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Paymentlink_idempotencyKey_key" ON "Paymentlink"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Paymentlink_bulkJobId_idx" ON "Paymentlink"("bulkJobId");

-- CreateIndex
CREATE INDEX "Paymentlink_status_idx" ON "Paymentlink"("status");

-- AddForeignKey
ALTER TABLE "Paymentlink" ADD CONSTRAINT "Paymentlink_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "BulkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
