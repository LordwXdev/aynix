import { Router } from "express";
import { userController } from "./user.controller.js";

export const userRoutes = Router();

// POST /api/users/register  ->  create a new user
userRoutes.post("/register", userController.register);
