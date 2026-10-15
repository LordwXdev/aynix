import { createServer } from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./shared/database/prisma.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";
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

const app = express();

// --- gateway layer: security, CORS, rate limits ---
// (later this moves to NGINX / an API gateway in front of the services)
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.corsOrigins.includes("*") ? "*" : env.corsOrigins }));
app.use(express.json({ limit: "1mb" }));

// a fair limit for everyone
app.use(
  "/api",
  rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false })
);

// a tight limit on login and sign up to slow down password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
app.use(["/api/users/login", "/api/users/register", "/api/users/refresh"], authLimiter);

app.get("/", (req, res) => {
  res.json({ message: "Aynix backend is alive" });
});

app.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

// --- modules ---
app.use("/api/users", userRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// --- event system: modules react to each other's events ---
registerDeliveryListeners();
registerNotificationListeners();
registerRealtimeListeners();

// --- start: one HTTP server shared by the API and the live socket ---
const server = createServer(app);
startRealtime(server);

server.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});

// close cleanly when the host restarts us
const shutdown = () => {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
