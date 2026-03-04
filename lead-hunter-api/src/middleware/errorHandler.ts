import { Request, Response } from "express";
import { AppError } from "../utils/AppError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response) => {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

    if (process.env.NODE_ENV === "development" || !(err instanceof AppError)) {
        console.error("[ERROR]:", err);
    }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
