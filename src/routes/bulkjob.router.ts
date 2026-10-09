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

export default router;
