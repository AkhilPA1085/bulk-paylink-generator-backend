import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma.js";

const router = Router();
const upload = multer({
  storage: multer?.memoryStorage(),
});

type PaymentLinkCsvRow = {
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
};

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "File is missing",
      });
    }
    const merchantId = req.body.merchantId;

    const csvContent = req.file.buffer.toString("utf-8");

    const records = parse<PaymentLinkCsvRow>(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const bulkJob = await prisma.bulkJob.create({
      data: {
        merchantId,
        fileName: req.file.originalname,
        totalRecords: records.length,
        status: "PROCESSING",
      },
    });

    let successfulRecords = 0;
    let failedRecords = 0;

    for (let i = 0; i < records?.length; i++) {
      const row = records[i];
      if (!row) {
        continue;
      }
      try {
        await prisma.paymentlink.create({
          data: {
            bulkJobId: bulkJob.id,
            idempotencyKey: `${bulkJob?.id}-row-${i + 1}`,
            customerName: row.customerName,
            customerEmail: row.customerEmail,
            amount: row.amount,
            currency: row.currency,
          },
        });
        successfulRecords++;
      } catch (error) {
        console.error(`Failed to generate paylink for row ${i + 1}`);
        failedRecords++;
      }
    }

    let finalStatus: "COMPLETED" | "COMPLETED_WITH_ERRORS";

    if (failedRecords === 0) {
      finalStatus = "COMPLETED";
    } else {
      finalStatus = "COMPLETED_WITH_ERRORS";
    }

    const completedJob = await prisma.bulkJob.update({
      where: {
        id: bulkJob.id,
      },
      data: {
        status: finalStatus,
        processedRecords: successfulRecords + failedRecords,
        successfulRecords,
        failedRecords,
        completedAt: new Date(),
      },
    });

    return res.status(200).json({
      error: false,
      message: "Bulk payment links processed successfully",
      data: completedJob,
    });
  } catch (error) {
    console.error("CSV Upload Error", error);
    return res.status(500).json({
      error: true,
      message: "CSV processing failed",
    });
  }
});

export default router;
