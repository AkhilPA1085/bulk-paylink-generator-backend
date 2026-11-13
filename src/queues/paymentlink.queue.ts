import { Queue } from "bullmq";
import redisClient from "../config/redisConnection.js";

export const PAYMENT_LINK_QUEUE = "payment-link-processing";

export const paymentLinkQueue = new Queue(PAYMENT_LINK_QUEUE, {
  connection: redisClient,
});
