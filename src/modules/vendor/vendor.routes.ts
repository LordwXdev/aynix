import { Router } from "express";
import { vendorController } from "./vendor.controller.js";
import { requireAuth } from "../../shared/middleware/auth.js";

export const vendorRoutes = Router();

// both routes need a logged-in user, so requireAuth guards both
userRoutesGuard();

function userRoutesGuard() {
  vendorRoutes.post("/", requireAuth, vendorController.createStore);
  vendorRoutes.get("/me", requireAuth, vendorController.getMyStore);
}
