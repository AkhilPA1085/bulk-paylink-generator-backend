import "dotenv/config";
import { Redis } from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null
});

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err: Error) => {
  console.error("Redis connection failed:", err);
});

export default redisClient;
