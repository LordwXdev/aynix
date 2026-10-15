import { Router } from "express";
import { orderController } from "./order.controller.js";
import { requireAuth, requireRole } from "../../shared/middleware/auth.js";
import { idempotent } from "../../shared/middleware/idempotency.js";

export const orderRoutes = Router();

// customer
// safe to retry: send an Idempotency-Key header
orderRoutes.post("/", requireAuth, idempotent, orderController.create);
orderRoutes.get("/", requireAuth, orderController.listMine);

// vendor (these must stay above "/:id")
orderRoutes.get("/vendor/items", requireAuth, requireRole("VENDOR"), orderController.vendorItems);
orderRoutes.get("/vendor/sales", requireAuth, requireRole("VENDOR"), orderController.vendorSales);
orderRoutes.patch(
  "/items/:itemId/status",
  requireAuth,
  requireRole("VENDOR"),
  orderController.updateItemStatus
);

// customer: one order
orderRoutes.get("/:id", requireAuth, orderController.getOne);
orderRoutes.get("/:id/tracking", requireAuth, orderController.tracking);
orderRoutes.post("/:id/cancel", requireAuth, idempotent, orderController.cancel);
