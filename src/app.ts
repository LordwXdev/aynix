import { createServer } from "node:http";
import express, { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./shared/database/prisma.js";
import { logger } from "./shared/logger.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";
import { requestLogger, requestTimeout } from "./shared/observability/http.js";
import { measureRequests } from "./shared/observability/metrics.js";
import { healthRoutes, markShuttingDown } from "./shared/observability/health.js";
import { registerBusinessMetrics } from "./shared/observability/business-metrics.js";
import { verifyAccessToken } from "./shared/middleware/auth.js";
import { RedisStore } from "rate-limit-redis";
import { redis, connectRedis, closeRedis } from "./shared/redis.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { vendorRoutes } from "./modules/vendor/vendor.routes.js";
import { productRoutes } from "./modules/market/product.routes.js";
import { categoryRoutes } from "./modules/market/category.routes.js";
import { orderRoutes } from "./modules/order/order.routes.js";
import { driverRoutes, deliveryRoutes } from "./modules/delivery/delivery.routes.js";
import { notificationRoutes } from "./modules/notification/notification.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { registerDeliveryListeners } from "./modules/delivery/delivery.listeners.js";
import { registerNotificationListeners } from "./modules/notification/notification.listeners.js";
import { registerRealtimeListeners } from "./modules/realtime/realtime.listeners.js";
import { startRealtime } from "./modules/realtime/realtime.gateway.js";
import { startJobs } from "./modules/jobs/jobs.js";

// the app is built after Redis connects: the shared rate-limit store needs a live connection
const createApp = () => {
  const app = express();

  // --- gateway layer: security, CORS, rate limits, logs, metrics ---
  // in production NGINX sits in front (see admin/nginx.conf) and handles gzip, caching and load balancing
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(measureRequests);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.includes("*") ? "*" : env.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestTimeout);

  // health checks and metrics: no rate limit, the orchestrator calls them often
  app.use(healthRoutes);

  app.get("/", (req, res) => {
    res.json({ message: "Aynix backend is alive", version: env.version });
  });

  // Haitian mobile carriers put many customers behind ONE public IP address (CGNAT),
  // so limits by IP alone would block real people. we count per user when logged in.
  const ipKey = (req: express.Request) => ipKeyGenerator(req.ip ?? "unknown");
  const userOrIpKey = (req: express.Request) => {
    const header = req.headers.authorization;
    const user = header?.startsWith("Bearer ") ? verifyAccessToken(header.slice(7)) : null;
    return user ? `user:${user.userId}` : `ip:${ipKey(req)}`;
  };

  // with Redis, every server shares the same counters (otherwise each counts on its own)
  const limiterStore = (prefix: string) =>
    redis
      ? new RedisStore({
          prefix: `rl:${prefix}:`,
          sendCommand: (...args: string[]) => redis!.sendCommand(args),
        })
      : undefined;

  // a fair limit for everyone
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: userOrIpKey,
      store: limiterStore("api"),
    })
  );

  // a tight limit on login and sign up to slow down password guessing,
  // counted per phone number + IP, so one attacker can't lock out a whole carrier
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.authRateLimit,
    keyGenerator: (req) => {
      const phone = typeof req.body?.phone === "string" ? req.body.phone.replace(/\s/g, "") : "";
      return `${ipKey(req)}|${phone}`;
    },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts, please try again later" },
    store: limiterStore("auth"),
  });
  for (const prefix of ["/api", "/api/v1"]) {
    app.use([`${prefix}/users/login`, `${prefix}/users/register`, `${prefix}/users/refresh`], authLimiter);
  }

  // public catalog: let phones and the CDN keep a copy for a short time
  const cachePublic = (seconds: number): express.RequestHandler => (req, res, next) => {
    if (req.method === "GET" && !req.headers.authorization) {
      res.setHeader("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
    }
    next();
  };

  // --- modules ---
  const api = Router();
  api.use("/users", userRoutes);
  api.use("/vendors", vendorRoutes);
  api.use("/products", cachePublic(30), productRoutes);
  api.use("/categories", cachePublic(300), categoryRoutes);
  api.use("/orders", orderRoutes);
  api.use("/drivers", driverRoutes);
  api.use("/deliveries", deliveryRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/admin", adminRoutes);

  // version 1 of the API. "/api" stays as an alias so today's apps keep working;
  // a future breaking change goes to "/api/v2" while v1 keeps running
  app.use("/api/v1", api);
  app.use("/api", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

// --- event system: modules react to each other's events ---
registerDeliveryListeners();
registerNotificationListeners();
registerRealtimeListeners();
registerBusinessMetrics();

// --- start: one HTTP server shared by the API and the live socket ---
const server = createServer();
// drop clients that are too slow to send their request
server.requestTimeout = env.requestTimeoutMs + 5_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 65_000; // a bit longer than the load balancer's
let io: ReturnType<typeof startRealtime>;
let stopJobs = () => {};

const start = async () => {
  await connectRedis(); // only if REDIS_URL is set
  server.on("request", createApp());
  io = startRealtime(server);
  stopJobs = startJobs();
  server.listen(env.port, () => {
    logger.info({ port: env.port, version: env.version }, `Server running on http://localhost:${env.port}`);
  });
};
start().catch((err) => {
  logger.fatal({ err }, "could not start");
  process.exit(1);
});

// graceful shutdown: stop taking new work, finish what is running, then exit
// (this is what makes rolling and blue-green deployments lose no requests)
let stopping = false;
const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  markShuttingDown(); // readiness now says "not ready", so the load balancer stops sending traffic
  stopJobs();
  io?.close();
  server.close(() => {
    Promise.allSettled([prisma.$disconnect(), closeRedis()]).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 15_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// log crashes in one clear line before exiting, so they show up in monitoring
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled promise rejection"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});
