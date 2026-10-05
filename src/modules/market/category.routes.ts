import { Router } from "express";
import { prisma } from "../../shared/database/prisma.js";

export const categoryRoutes = Router();

// GET /api/categories  ->  list active categories
categoryRoutes.get("/", async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ categories });
});