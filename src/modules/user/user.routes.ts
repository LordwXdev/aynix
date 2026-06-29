import { Router } from "express";
import { userController } from "./user.controller.js";

export const userRoutes = Router();

// POST /api/users/register  ->  create a new user
userRoutes.post("/register", userController.register);

// POST /api/users/login  ->  log in and get a token
userRoutes.post("/login", userController.login);
