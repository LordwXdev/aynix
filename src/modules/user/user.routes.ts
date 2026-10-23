import { Router } from "express";
import { userController } from "./user.controller.js";
import { requireAuth } from "../../shared/middleware/auth.js";

export const userRoutes = Router();

// public routes, no token needed
userRoutes.post("/register", userController.register);
userRoutes.post("/login", userController.login);
userRoutes.post("/refresh", userController.refresh);
userRoutes.post("/logout", userController.logout);

// protected routes, token required
userRoutes.get("/me", requireAuth, userController.getProfile);
userRoutes.patch("/me", requireAuth, userController.updateProfile);
userRoutes.post("/logout-all", requireAuth, userController.logoutAll);
