import { Router } from "express";
import { vendorController } from "./vendor.controller.js";
import { requireAuth } from "../../shared/middleware/auth.js";

export const vendorRoutes = Router();

// POST /api/vendors  ->  create a store (must be logged in)
vendorRoutes.post("/", requireAuth, vendorController.createStore);

// GET /api/vendors/me  ->  get my own store (must be logged in)
vendorRoutes.get("/me", requireAuth, vendorController.getMyStore);

// PATCH /api/vendors/me  ->  edit my store
vendorRoutes.patch("/me", requireAuth, vendorController.updateMyStore);

// GET /api/vendors/:slug  ->  public store page (must stay below "/me")
vendorRoutes.get("/:slug", vendorController.getPublicStore);
