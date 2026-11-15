import { Router } from "express";
import multer from "multer";
import prisma from "../lib/prisma.js";
import { validateCsvUpload } from "../middlewares/validateCsvUpload.js";
import { extname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { paymentLinkQueue } from "../queues/paymentlink.queue.js";

const router = Router();
const uploadDir = join(process.cwd(), "uploads");

// Create the upload directory if it doesn't exist.
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, uploadDir);
    },
    filename: (req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
});

router.post("/", upload.single("file"), validateCsvUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "File is missing",
      });
    }
    const merchantId = req.body.merchantId.trim();

    // Step 1: Create a database record.
    const bulkJob = await prisma.bulkJob.create({
      data: {
        merchantId,
        fileName: req.file.originalname,
        totalRecords: 0,
        status: "UPLOADED",
      },
    });

    // Step 2: Add a processing job to BullMQ.
    await paymentLinkQueue.add(
      "process-payment-links",
      {
        bulkJobId: bulkJob.id,
        filePath: req.file.path,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    return res.status(202).json({
      error: false,
      message: "Bulk payment link processing queued successfully",
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
