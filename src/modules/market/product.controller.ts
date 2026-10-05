import { Request, Response } from "express";
import { productService } from "./product.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

export const productController = {
  // POST /api/products  (vendor only)
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const {
        name,
        description,
        price,
        comparePrice,
        stockQty,
        images,
        categoryId,
        status,
      } = req.body;

      if (!name || price === undefined || !categoryId) {
        return res
          .status(400)
          .json({ error: "name, price, and categoryId are required" });
      }

      const product = await productService.createProduct({
        userId,
        categoryId,
        name,
        description,
        price: Number(price),
        comparePrice: comparePrice !== undefined ? Number(comparePrice) : undefined,
        stockQty: stockQty !== undefined ? Number(stockQty) : undefined,
        images,
        status,
      });

      return res.status(201).json({ message: "Product created", product });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/products?q=shoes&categoryId=...&page=1&limit=20  (public)
  list: async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const categoryId =
        typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await productService.listProducts({ q, categoryId, page, limit });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/products/:id  (public)
  getOne: async (req: Request, res: Response) => {
    try {
      const product = await productService.getProduct(String(req.params.id));
      return res.status(200).json({ product });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // GET /api/products/mine  (vendor only)
  mine: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const products = await productService.listMyProducts(userId);
      return res.status(200).json({ products });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // PATCH /api/products/:id  (vendor only, own products)
  update: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { name, description, price, comparePrice, stockQty, images, status } =
        req.body;

      const product = await productService.updateProduct(
        userId,
        String(req.params.id),
        {
          name,
          description,
          price: price !== undefined ? Number(price) : undefined,
          comparePrice: comparePrice !== undefined ? Number(comparePrice) : undefined,
          stockQty: stockQty !== undefined ? Number(stockQty) : undefined,
          images,
          status,
        }
      );

      return res.status(200).json({ message: "Product updated", product });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },
};