import prisma from "../lib/prisma.js";
import type {
  PaymentLinkCsvRow,
  FailePaylinkRow,
  PaymentLinkBatchRow,
} from "../types/paymentLink.js";
import { validateCsvRow } from "../utils/validateCsvRow.js";
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { randomBytes } from "node:crypto";

function generatePaymentToken(): string {
  return randomBytes(32).toString("hex");
}

async function processBatch(
  bulkJobId: string,
  successfulRows: PaymentLinkBatchRow[],
  failedRows: FailePaylinkRow[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const successResult = await tx.paymentlink.createMany({
      data: successfulRows.map((row) => {
        const paymentToken = generatePaymentToken();
        return {
          bulkJobId,
          idempotencyKey: `${bulkJobId}-row-${row.rowNumber}`,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          amount: row.amount,
          currency: row.currency,
          paymentToken,
          paymentUrl: `${process.env.BASE_URL}/pay/${paymentToken}`,
        };
      }),
      skipDuplicates: true,
    });

    const failedResult = await tx.failedPaymentLink.createMany({
      data: failedRows.map((row) => ({
        bulkJobId,
        rowNumber: row.rowNumber,
        rowData: row.rowData,
        errorMessage: row.errorMessage,
      })),
      skipDuplicates: true,
    });

    const successfulRecords = successResult.count;
    const failedRecords = failedResult.count;
    const processedRecords = successfulRecords + failedRecords;

    await tx.bulkJob.update({
      where: { id: bulkJobId },
      data: {
        totalRecords: { increment: processedRecords },
        processedRecords: { increment: processedRecords },
        successfulRecords: { increment: successfulRecords },
        failedRecords: { increment: failedRecords },
      },
    });
  });
}

export async function processPaymentLinks(
  bulkJobId: string,
  filePath: string,
): Promise<void> {
  const batchSize = 100;

  try {
    await prisma.bulkJob.update({
      where: { id: bulkJobId },
      data: {
        status: "PROCESSING",
      },
    });

    const parser = createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

    let successfulRows: PaymentLinkBatchRow[] = [];
    let failedRows: FailePaylinkRow[] = [];
    let rowNumber = 0;

    for await (const record of parser) {
      rowNumber++;

      const row = record as PaymentLinkCsvRow;

      const validationError = validateCsvRow(row);

      if (validationError) {
        failedRows.push({
          rowNumber,
          rowData: row,
          errorMessage: validationError,
        });
      } else {
        successfulRows.push({
          ...row,
          rowNumber,
        });
      }

      if (rowNumber % batchSize === 0) {
        console.log(`Processing CSV rows up to ${rowNumber}`);

        await processBatch(bulkJobId, successfulRows, failedRows);

        successfulRows = [];
        failedRows = [];
      }
    }

    if (successfulRows.length > 0 || failedRows.length > 0) {
      await processBatch(bulkJobId, successfulRows, failedRows);
    }

    const job = await prisma.bulkJob.findUnique({
      where: { id: bulkJobId },
      select: {
        failedRecords: true,
      },
    });

    if (!job) {
      throw new Error(`Bulk Job ${bulkJobId} not found`);
    }

    await prisma.bulkJob.update({
      where: { id: bulkJobId },
      data: {
        status: job.failedRecords > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Background processing failed for job ${bulkJobId}:`, error);

    throw error;
  }
}
