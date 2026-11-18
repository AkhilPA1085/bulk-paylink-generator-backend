import { Router } from "express";
import prisma from "../lib/prisma.js";
import { generateTransactionId } from "../utils/generateTransactionId.js";

const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(404).json({
        error: true,
        message: "Token is required",
      });
    }

    const paymentLink = await prisma.paymentlink.findUnique({
      where: {
        paymentToken: token,
      },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    if (!paymentLink) {
      return res.status(404).json({
        error: true,
        message: "Invalid payment link",
      });
    }

    return res.status(200).json({
      error: false,
      message: "Payment link retrieved successfully",
      data: paymentLink,
    });
  } catch (error) {
    console.error("Public Payment Link Error:", error);

    return res.status(500).json({
      error: true,
      message: "Unable to retrieve payment details",
    });
  }
});

router.post("/:token/checkout", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(404).json({
        error: true,
        message: "Token is missing",
      });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const paymentlink = await tx.paymentlink.findUnique({
        where: {
          paymentToken: token,
        },
        select: {
          id: true,
          amount: true,
          currency: true,
        },
      });

      if (!paymentlink) {
        return null;
      }

      const result = await tx.paymentlink.updateMany({
        where: {
          paymentToken: token,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
        },
      });

      if (result.count === 0) {
        return null;
      }

      const newTransaction = await tx.paymentTransaction.create({
        data: {
          paymentLinkId: paymentlink.id,
          transactionId: generateTransactionId(),
          amount: paymentlink.amount,
          currency: paymentlink.currency,
          status: "INITIATED",
        },
        select: {
          id: true,
          transactionId: true,
          paymentLinkId: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      });

      return newTransaction;
    });

    if (!transaction) {
      return res.status(409).json({
        error: true,
        message: "Payment link is invalid or already processed",
      });
    }

    return res.status(200).json({
      error: false,
      message: "Payment transaction initiated successfully",
      data: transaction,
    });
  } catch (error) {
    console.log("Checkout Error", error);

    return res.status(500).json({
      error: true,
      message: "Unable to initiate payment",
    });
  }
});

export default router;
