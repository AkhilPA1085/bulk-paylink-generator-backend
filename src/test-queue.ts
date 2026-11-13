import { paymentLinkQueue } from "./queues/paymentlink.queue.js";


async function testQueue() {
  try {
    const job = await paymentLinkQueue.add("test-payment-job", {
      message: "Hello from BullMQ",
      createdAt: new Date().toISOString(),
    });

    console.log("Job added successfully!");
    console.log("Job ID:", job.id);

    const state = await job.getState();
    console.log("Job state:", state);
  } catch (error) {
    console.error("Queue test failed:", error);
  } finally {
    await paymentLinkQueue.close();
  }
}

testQueue();
