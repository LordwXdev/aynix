import { Router } from "express";
import { productController } from "./product.controller.js";
import { requireAuth } from "../../shared/middleware/auth.js";

export const productRoutes = Router();

// public: anyone can browse and search
productRoutes.get("/", productController.list);

// vendor: see my own products (this must stay above "/:id")
productRoutes.get("/mine", requireAuth, productController.mine);

// public: one product
productRoutes.get("/:id", productController.getOne);

// vendor: add and edit products
productRoutes.post("/", requireAuth, productController.create);
productRoutes.patch("/:id", requireAuth, productController.update);