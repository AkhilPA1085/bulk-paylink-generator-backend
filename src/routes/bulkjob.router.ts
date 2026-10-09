import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { merchantId, fileName } = req.body;

    if (!merchantId || !fileName) {
      return res.status(400).json({
        error: true,
        message: "Required fields are missing",
      });
    }

    const bulkJob = await prisma.bulkJob.create({
      data: {
        merchantId,
        fileName,
      },
    });

    return res.status(201).json({
      error: false,
      message: "New Job Created",
      data: bulkJob,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: error || "Something went wrong",
    });
  }
});

router.get("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        error: true,
        message: "JobId is required",
      });
    }

    const job = await prisma.bulkJob.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return res.status(404).json({
        error: true,
        message: "No Job exists",
      });
    }

    return res.status(200).json({
      error: false,
      message: "Job Found",
      data: job,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: error || "Something went wrong",
    });
  }
});

router.get("/:jobId/failed-rows", async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: true,
        message: "Job Id is missing",
      });
    }

    const job = await prisma.bulkJob.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return res.status(404).json({
        error: true,
        message: "Job Not Found",
      });
    }

    const failedRows = await prisma.failedPaymentLink.findMany({
      where: { bulkJobId: jobId },
      orderBy: { rowNumber: "asc" },
      select: {
        id: true,
        rowNumber: true,
        rowData: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      error: false,
      message: "Failed rows retrieved successfully",
      data: {
        jobId,
        totalFailedRows: failedRows.length,
        failedRows,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve failed rows:", error);

    return res.status(500).json({
      error: true,
      message: "Failed to retrieve failed rows",
    });
  }
});

export default router;
