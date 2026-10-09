import { Router } from "express";
import { orderController } from "./order.controller.js";
import { requireAuth } from "../../shared/middleware/auth.js";

export const orderRoutes = Router();

// customer
orderRoutes.post("/", requireAuth, orderController.create);
orderRoutes.get("/", requireAuth, orderController.listMine);

// vendor (these must stay above "/:id")
orderRoutes.get("/vendor/items", requireAuth, orderController.vendorItems);
orderRoutes.patch("/items/:itemId/status", requireAuth, orderController.updateItemStatus);

// customer: one order
orderRoutes.get("/:id", requireAuth, orderController.getOne);
