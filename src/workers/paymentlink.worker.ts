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
  const concurrencyLimit = 5;

  try {
    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      console.log(
        `Processing batch: rows ${start + 1} to ${start + batch.length}`,
      );
      for (let offset = 0; offset < batch.length; offset += concurrencyLimit) {
        const concurrentRows = batch.slice(offset, offset + concurrencyLimit);

        const results = await Promise.allSettled(
          concurrentRows.map(async (row, index) => {
            const rowNumber = start + offset + index + 1;

            if (!row) {
              failedRecords++;
              return;
            }

            const validationError = validateCsvRow(row);

            if (validationError) {
              await saveFailedRow(bulkJobId, rowNumber, row, validationError);
              console.error(
                `Validation failed for CSV row ${rowNumber}: ${validationError}`,
              );
              failedRecords++;
              return;
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
          }),
        );

        const unexpectedFailure = results.find(
          (result)=>result.status==='rejected'
        )

        if(unexpectedFailure){
          throw unexpectedFailure.reason
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
