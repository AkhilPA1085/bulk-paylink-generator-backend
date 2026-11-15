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
      select: {
        id: true,
        merchantId: true,
        fileName: true,
        status: true,
        totalRecords: true,
        processedRecords: true,
        successfulRecords: true,
        failedRecords: true,
        createdAt: true,
        completedAt: true,
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

router.get("/:jobId/payment-links", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(404).json({
        error: true,
        message: `Job id not found`,
      });
    }

    const page = Number(req.query.page) ?? 1;
    const limit = Number(req.query.limit) ?? 20;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        error: true,
        message: "Page must be an integer",
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: true,
        message: "Limit must be a positive number between 1 and 100",
      });
    }

    const job = await prisma.bulkJob.findUnique({
      where: {
        id: jobId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!job) {
      return res.status(404).json({
        error: true,
        message: "Bulk Job not found",
      });
    }

    if (job.status === "UPLOADED" || job.status === "PROCESSING") {
      return res.status(409).json({
        error: true,
        message: "Payment links are still being processed",
        data: {
          jobId,
          status: job.status,
        },
      });
    }

    const skip = (page - 1) * limit;

    const [paymentlinks, totalPaymentLinks] = await Promise.all([
      prisma.paymentlink.findMany({
        where: { bulkJobId: jobId },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          amount: true,
          currency: true,
          status: true,
          errorMessage: true,
          paymentUrl: true,
          createdAt: true,
        },
      }),

      prisma.paymentlink.count({
        where: { bulkJobId: jobId },
      }),
    ]);

    res.status(200).json({
      error:false,
      message:"Payment links retrieved successfully",
      data:{
        jobId,
        totalPaymentLinks,
        currentPage:page,
        pageSize:limit,
        totalPages:Math.ceil(totalPaymentLinks/limit),
        paymentlinks
      }
    })
  } catch (error) {
    console.log(`Error while retrieving payment links, ${error}`)

    return res.status(500).json({
      error:true,
      message:"Failed to retrieve the payment links"
    })
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
