import { Router } from "express";
import { categoryService } from "./category.service.js";

export const categoryRoutes = Router();

// GET /api/categories  ->  list active categories
categoryRoutes.get("/", async (req, res) => {
  const categories = await categoryService.listActive();
  res.json({ categories });
});
