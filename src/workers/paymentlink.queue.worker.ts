import { Worker } from "bullmq";
import redisClient from "../config/redisConnection.js";
import type { PaylinkJobData } from "../types/paymentLink.js";
import { processPaymentLinks } from "./paymentlink.worker.js";
import prisma from "../lib/prisma.js";

const PAYMENT_LINK_QUEUE = "payment-link-processing";

const paymentLinkWorker = new Worker<PaylinkJobData>(
  PAYMENT_LINK_QUEUE,
  async (job) => {
    const { bulkJobId, filePath } = job.data;
    console.log("Received a BullMQ job!");
    console.log("Job ID:", job.id);
    console.log("Job name:", job.name);
    console.log("Job data:", job.data);
    console.log("Bulk Job Id:", bulkJobId);
    console.log("File Path:", filePath);

    await processPaymentLinks(bulkJobId, filePath);
  },
  {
    connection: redisClient,
    concurrency: 1,
  },
);

paymentLinkWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

paymentLinkWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);

  if (!job) return;

  const maxAttempts = job?.opts.attempts ?? 1;

  if (job.attemptsMade >= maxAttempts) {
    console.log("All retry attempts exhausted.");

    void prisma.bulkJob
      .update({
        where: {
          id: job.data.bulkJobId,
        },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      })
      .then(() => {
        console.log(`Bulk Job ${job.data.bulkJobId} marked as FAILED`);
      })
      .catch((dbError) => {
        console.error("Failed to update BulkJob status:", dbError);
      });
  } else {
    console.log(`Retrying job. Attempt ${job.attemptsMade} of ${maxAttempts}`);
  }
});

console.log("Payment link worker is listening for jobs...");
