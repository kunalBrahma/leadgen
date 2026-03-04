import { Redis } from "ioredis";
import { env } from "../config/env";

const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisClient.on("error", (err: Error) => {
  console.error("Redis error:", err);
});

redisClient.on("connect", () => {
  console.log("[SUCCESS] Connected to Redis successfully");
});

export default redisClient;
