import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "../logger.js";
import { env } from "../../config/env.js";

// every request gets an id. it is in every log line and sent back as X-Request-Id,
// so one request can be followed from the app, through the gateway, to the database
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && incoming.length <= 100 ? incoming : crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  // health checks and metrics are called every few seconds: don't fill the logs with them
  autoLogging: { ignore: (req) => req.url?.startsWith("/health") || req.url === "/metrics" },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

// a request that runs too long gets a clean 503 instead of hanging the app
export const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "The server took too long, please try again" });
    }
  }, env.requestTimeoutMs);
  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
};
