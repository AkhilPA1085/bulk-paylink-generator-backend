import express from "express";
import prisma from "./lib/prisma.js";

import bulkPaymentLinkRoutes from "./routes/bulkjob.router.js";
import paymentLinkRoutes from "./routes/paymentlink.router.js";
import csvUploadRoutes from "./routes/csvUpload.router.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "OK",
    message: "Payment link Backend is running successfully",
  });
});

app.get("/api/test-db", async (_req, res) => {
  try {
    const jobs = await prisma.bulkJob.findMany();

    res.json({
      status: "OK",
      message: "Database connection is working",
      jobs,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
    });
  }
});

app.use("/api/bulk-payment-links", bulkPaymentLinkRoutes);
app.use("/api/payment-links", paymentLinkRoutes);
app.use("/api/upload-csv", csvUploadRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
