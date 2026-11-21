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

router.post("/transactions/:transactionId/simulate", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    if (status !== "SUCCESS" && status !== "FAILED") {
      return res.status(400).json({
        error: true,
        message: "Status must be SUCCESS or FAILED",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingTransaction = await tx.paymentTransaction.findUnique({
        where: { transactionId },
        select: {
          id: true,
          paymentLinkId: true,
          status: true,
          paymentLink: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!existingTransaction) {
        return { kind: "NOT_FOUND" as const };
      }

      if (
        existingTransaction.status !== "INITIATED" ||
        existingTransaction.paymentLink.status !== "PROCESSING"
      ) {
        return { kind: "CONFLICT" as const };
      }

      const transactionUpdate = await tx.paymentTransaction.updateMany({
        where: {
          id: existingTransaction.id,
          status: "INITIATED",
        },
        data: {
          status,
        },
      });

      if (transactionUpdate.count === 0) {
        return { kind: "CONFLICT" as const };
      }

      const paymentListUpdate = await tx.paymentlink.updateMany({
        where: {
          id: existingTransaction.paymentLinkId,
          status: "PROCESSING",
        },
        data: {
          status,
        },
      });

      if (paymentListUpdate.count === 0) {
        throw new Error("PAYMENT_LINK_STATE_CONFLICT");
      }

      return {
        kind: "SUCCESS" as const,
        data: {
          transactionId,
          paymentLinkId: existingTransaction.paymentLinkId,
          transactionStatus: status,
          paymentLinkStatus: status,
        },
      };
    });

    if (result.kind === "NOT_FOUND") {
      return res.status(404).json({
        error: true,
        message: "Transaction not found",
      });
    }

    if (result.kind === "CONFLICT") {
      return res.status(409).json({
        error: true,
        message: "Transaction is already processed or cannot be completed",
      });
    }

    return res.status(200).json({
      error: false,
      message: "Payment result simulated successfully",
      data: result.data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PAYMENT_LINK_STATE_CONFLICT"
    ) {
      return res.status(409).json({
        error: true,
        message: "Payment link state changed. Payment result was not applied",
      });
    }

    console.error("Payment Simulated Error:", error);

    return res.status(500).json({
      error: true,
      message: "Unable to simulate payment result",
    });
  }
});

export default router;
