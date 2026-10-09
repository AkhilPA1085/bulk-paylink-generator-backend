import prisma from "../lib/prisma.js";
import type { PaymentLinkCsvRow } from "../types/paymentLink.js";
import { validateCsvRow } from "../utils/validateCsvRow.js";

async function saveFailedRow(
  bulkJobId: string,
  rowNumber: number,
  rowData: PaymentLinkCsvRow,
  errorMessage: string,
): Promise<boolean> {
  try {
    await prisma.failedPaymentLink.create({
      data: {
        bulkJobId,
        rowNumber,
        rowData,
        errorMessage,
      },
    });
    return true;
  } catch (error) {
    console.error(
      `Could not save failure details for CSV row ${rowNumber}:`,
      error,
    );
    return false;
  }
}

export async function processPaymentLinks(
  bulkJobId: string,
  records: PaymentLinkCsvRow[],
): Promise<void> {
  let successfulRecords = 0;
  let failedRecords = 0;
  const batchSize = 100;

  try {
    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      console.log(
        `Processing batch: rows ${start + 1} to ${start + batch.length}`,
      );
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNumber = start + i + 1;
  
        if (!row) {
          failedRecords++;
          continue;
        }
  
        const validationError = validateCsvRow(row);
  
        if (validationError) {
          await saveFailedRow(bulkJobId, rowNumber, row, validationError);
          console.error(
            `Validation failed for CSV row ${rowNumber}: ${validationError}`,
          );
          failedRecords++;
          continue;
        }
  
        try {
          await prisma.paymentlink.create({
            data: {
              bulkJobId,
              idempotencyKey: `${bulkJobId}-row-${rowNumber}`,
              customerName: row.customerName,
              customerEmail: row.customerEmail,
              amount: row.amount,
              currency: row.currency,
            },
          });
  
          successfulRecords++;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown payment-link processing error";
  
          console.error(`Failed to process CSV row ${rowNumber}:`, error);
  
          await saveFailedRow(bulkJobId, rowNumber, row, errorMessage);
          failedRecords++;
        }
      }
    }

    await prisma.bulkJob.update({
      where: { id: bulkJobId },
      data: {
        status: failedRecords === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS",
        processedRecords: successfulRecords + failedRecords,
        successfulRecords,
        failedRecords,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Background processing failed for job ${bulkJobId}:`, error);

    try {
      await prisma.bulkJob.update({
        where: { id: bulkJobId },
        data: {
          status: "FAILED",
          processedRecords: successfulRecords + failedRecords,
          successfulRecords,
          failedRecords,
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error(`Could not mark job ${bulkJobId} as FAILED:`, updateError);
    }
  }
}
