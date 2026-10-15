import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { withTimeout } from "../utils/resilience.js";
import { env } from "../../config/env.js";
import { registry } from "./metrics.js";
import { sms } from "../sms/sms.js";
import { redis } from "../redis.js";

let shuttingDown = false;
export const markShuttingDown = () => {
  shuttingDown = true;
};

const startedAt = Date.now();

export const healthRoutes = Router();

// liveness: "is the process alive?" if this fails, restart the container
healthRoutes.get("/health/live", (req, res) => {
  res.json({ status: "ok", version: env.version, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
});

// readiness: "can it take traffic right now?" if this fails, stop sending requests here
// (database down, or the server is shutting down for a new version)
const ready = async (req: unknown, res: import("express").Response) => {
  if (shuttingDown) return res.status(503).json({ status: "shutting_down" });
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2_000);
  } catch {
    return res.status(503).json({ status: "unavailable", checks: { database: "down" } });
  }
  let cache = "not used";
  if (redis) {
    try {
      await withTimeout(redis.ping(), 1_000);
      cache = "ok";
    } catch {
      return res.status(503).json({ status: "unavailable", checks: { database: "ok", redis: "down" } });
    }
  }
  res.json({ status: "ok", version: env.version, checks: { database: "ok", redis: cache, sms: sms.state } });
};
healthRoutes.get("/health/ready", ready);
healthRoutes.get("/health", ready);

// numbers for Prometheus. protect it with METRICS_TOKEN in production
healthRoutes.get("/metrics", async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).end();
  }
  res.setHeader("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
