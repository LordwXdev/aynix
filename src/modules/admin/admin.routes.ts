import { Router } from "express";
import { adminController } from "./admin.controller.js";
import { requireAuth, requireRole } from "../../shared/middleware/auth.js";

export const adminRoutes = Router();

// every route here is admins only
adminRoutes.use(requireAuth, requireRole("ADMIN"));

adminRoutes.get("/dashboard", adminController.dashboard);

adminRoutes.get("/users", adminController.listUsers);
adminRoutes.patch("/users/:id/active", adminController.setUserActive);

adminRoutes.get("/vendors", adminController.listVendors);
adminRoutes.patch("/vendors/:id/status", adminController.setVendorStatus);

adminRoutes.get("/drivers", adminController.listDrivers);
adminRoutes.patch("/drivers/:id/status", adminController.setDriverStatus);

adminRoutes.get("/orders", adminController.listOrders);
adminRoutes.get("/orders/:id", adminController.getOrder);
adminRoutes.post("/orders/:id/cancel", adminController.cancelOrder);
adminRoutes.patch("/order-items/:itemId/status", adminController.setItemStatus);

adminRoutes.get("/deliveries", adminController.listDeliveries);
adminRoutes.post("/deliveries/:id/assign", adminController.assignDriver);
adminRoutes.post("/deliveries/:id/auto-assign", adminController.autoAssign);

adminRoutes.get("/categories", adminController.listCategories);
adminRoutes.post("/categories", adminController.createCategory);
adminRoutes.patch("/categories/:id", adminController.updateCategory);
