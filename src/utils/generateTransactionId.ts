import { randomUUID } from "node:crypto";

export function generateTransactionId(): string {
  return `txn_${randomUUID().replace(/-/g, "")}`;
}
