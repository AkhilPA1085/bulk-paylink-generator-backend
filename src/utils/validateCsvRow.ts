import type { PaymentLinkCsvRow } from "../types/paymentLink.js";

export function validateCsvRow(record: PaymentLinkCsvRow): string | null {
  if (
    !record.customerName?.trim() ||
    !record.customerEmail?.trim() ||
    !record.amount?.trim() ||
    !record.currency?.trim()
  ) {
    return "Required fields are missing";
  }

  const amount = Number(record.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Amount should be a valid positive number greater than 0";
  }

  // Allow a maximum of 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(record.amount.trim())) {
    return "Amount should not have more than 2 decimal places";
  }

  if (record.currency.trim().toUpperCase() !== "INR") {
    return "Currency should be INR only";
  }

  return null;
}
