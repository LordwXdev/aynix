import { Router } from "express";
import { driverController, deliveryController } from "./delivery.controller.js";
import { requireAuth, requireRole } from "../../shared/middleware/auth.js";

// --- /api/drivers ---
export const driverRoutes = Router();

// any logged-in customer can apply
driverRoutes.post("/", requireAuth, driverController.apply);

driverRoutes.get("/me", requireAuth, requireRole("DRIVER"), driverController.me);
driverRoutes.patch("/me/online", requireAuth, requireRole("DRIVER"), driverController.setOnline);
driverRoutes.post("/me/location", requireAuth, requireRole("DRIVER"), driverController.location);

// --- /api/deliveries (driver app) ---
export const deliveryRoutes = Router();

deliveryRoutes.use(requireAuth, requireRole("DRIVER"));
deliveryRoutes.get("/mine", deliveryController.mine);
deliveryRoutes.post("/:id/decline", deliveryController.decline);
deliveryRoutes.post("/:id/pickup", deliveryController.pickUp);
deliveryRoutes.post("/:id/deliver", deliveryController.deliver);
deliveryRoutes.post("/:id/fail", deliveryController.fail);
