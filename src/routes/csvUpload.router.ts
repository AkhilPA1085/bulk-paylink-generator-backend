import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma.js";
import { processPaymentLinks } from "../workers/paymentlink.worker.js";

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

    void processPaymentLinks(bulkJob.id, records).catch((error) => {
      console.error(`Unexpected worker error for job ${bulkJob.id}:`, error);
    });

    return res.status(202).json({
      error: false,
      message: "Bulk payment link processing started",
      data: {
        jobId: bulkJob.id,
        status: bulkJob.status,
        totalRecords: bulkJob.totalRecords,
      },
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
