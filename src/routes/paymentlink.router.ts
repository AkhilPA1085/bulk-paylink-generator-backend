import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      bulkJobId,
      customerName,
      customerEmail,
      amount,
      currency,
      idempotencyKey,
    } = req.body;

    if (
      !bulkJobId ||
      !customerName ||
      !customerEmail ||
      amount == null ||
      !currency ||
      !idempotencyKey
    ) {
      return res.status(400).json({
        error: true,
        message: "Required fields are missing",
      });
    }

    const bulkJob = await prisma.bulkJob.findUnique({
        where:{
            id:bulkJobId
        }
    });

    if(!bulkJob){
        return res.status(404).json({
            error:true,
            message:"Job Not Found"
        })
    }

    const newPaymentLink = await prisma.paymentlink.create({
      data: {
        bulkJobId,
        customerName,
        customerEmail,
        amount,
        currency,
        idempotencyKey,
      },
    });

    return res.status(201).json({
      error: false,
      message: "Payment link created",
      data: newPaymentLink,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: true,
      message: "Payment Link Generation Failed",
    });

  }
});

export default router;
