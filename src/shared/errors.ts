import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

// throw this from any service to send a clean error with the right status code
export class AppError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const notFound = (message: string) => new AppError(404, message);
export const forbidden = (message: string) => new AppError(403, message);
export const unauthorized = (message: string) => new AppError(401, message);

const isPrismaError = (err: unknown, code: string) =>
  typeof err === "object" && err !== null && "code" in err && err.code === code;

// last stop for any error that a route did not handle itself
// express 5 sends errors from async routes here automatically
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // bad JSON in the request body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // a unique field (phone, email, slug...) is already taken
  if (isPrismaError(err, "P2002")) {
    return res.status(409).json({ error: "This value is already in use" });
  }
  // a row we tried to update or link to does not exist
  if (isPrismaError(err, "P2025") || isPrismaError(err, "P2003")) {
    return res.status(404).json({ error: "Not found" });
  }

  logger.error({ err, requestId: req.id }, "unhandled error");
  return res.status(500).json({ error: "Something went wrong" });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
};
