import type { NextFunction, Request, Response } from "express";

export function validateCsvUpload(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  if (!req.body.merchantId.trim()) {
    return res.status(400).json({
      error: true,
      message: "Merchant Id is required",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: true,
      message: "File is required",
    });
  }

  const isCsvFile = req.file.originalname.toLowerCase().endsWith(".csv");

  if (!isCsvFile) {
    return res.status(400).json({
      error: true,
      message: "Upload only CSV file",
    });
  }

  next();
}
