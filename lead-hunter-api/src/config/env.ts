import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Auth
  JWT_SECRET: z.string().min(32, "Security Warning: JWT_SECRET should be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  
  // Storage
  STORAGE_TYPE: z.enum(["local", "s3", "r2"]).default("local"),
  
  // Redis
  REDIS_URL: z.string().url(),

  // Mail
  RESEND_API_KEY: z.string().min(1),

  // Payments
  PAYMENT_PROVIDER: z.enum(["stripe", "razorpay"]).default("stripe"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default("*"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("[ERROR] Invalid Environment Variables:", JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
