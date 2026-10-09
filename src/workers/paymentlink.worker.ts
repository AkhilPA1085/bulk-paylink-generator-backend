import prisma from "../lib/prisma.js";

type paymentLinksRecord = {
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
};

export async function processPaymentLinks(
  bulkJobId: string,
  records: paymentLinksRecord[],
): Promise<void> {
  let successfulRecords = 0;
  let failedRecords = 0;

  try {
    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      if (!row) {
        failedRecords++;
        continue;
      }

      try {
        await prisma.paymentlink.create({
          data: {
            bulkJobId,
            idempotencyKey: `${bulkJobId}-row-${i + 1}`,
            customerName: row.customerName,
            customerEmail: row.customerEmail,
            amount: row.amount,
            currency: row.currency,
          },
        });

        successfulRecords++;
      } catch (error) {
        console.error(`Failed to process CSV row ${i + 1}:`, error);
        failedRecords++;
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
  }
}
