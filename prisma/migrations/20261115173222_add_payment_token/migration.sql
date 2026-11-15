/*
  Warnings:

  - A unique constraint covering the columns `[paymentToken]` on the table `Paymentlink` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Paymentlink" ADD COLUMN     "paymentToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Paymentlink_paymentToken_key" ON "Paymentlink"("paymentToken");
