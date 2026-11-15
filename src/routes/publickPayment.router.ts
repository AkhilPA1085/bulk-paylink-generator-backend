import { Router } from "express";
import prisma from "../lib/prisma.js";

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

export default router;
