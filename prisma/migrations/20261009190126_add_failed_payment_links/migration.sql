-- CreateTable
CREATE TABLE "FailedPaymentLink" (
    "id" TEXT NOT NULL,
    "bulkJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedPaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedPaymentLink_bulkJobId_idx" ON "FailedPaymentLink"("bulkJobId");

-- CreateIndex
CREATE UNIQUE INDEX "FailedPaymentLink_bulkJobId_rowNumber_key" ON "FailedPaymentLink"("bulkJobId", "rowNumber");

-- AddForeignKey
ALTER TABLE "FailedPaymentLink" ADD CONSTRAINT "FailedPaymentLink_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "BulkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
