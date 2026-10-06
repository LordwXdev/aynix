import { Response } from "express";
import { orderService } from "./order.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

export const orderController = {
  // POST /api/orders
  create: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const {
        items,
        deliveryAddress,
        deliveryCity,
        deliveryDepartment,
        deliveryNotes,
        paymentMethod,
      } = req.body;

      if (!Array.isArray(items) || !deliveryAddress || !deliveryCity || !deliveryDepartment) {
        return res.status(400).json({
          error: "items, deliveryAddress, deliveryCity, and deliveryDepartment are required",
        });
      }

      const order = await orderService.createOrder({
        customerId: userId,
        items,
        deliveryAddress,
        deliveryCity,
        deliveryDepartment,
        deliveryNotes,
        paymentMethod: paymentMethod ?? "CASH_ON_DELIVERY",
      });

      return res.status(201).json({ message: "Order placed", order });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/orders
  listMine: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const orders = await orderService.listMyOrders(userId);
      return res.status(200).json({ orders });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/orders/:id
  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const order = await orderService.getMyOrder(userId, String(req.params.id));
      return res.status(200).json({ order });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // GET /api/orders/vendor/items
  vendorItems: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const items = await orderService.listVendorItems(userId);
      return res.status(200).json({ items });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // PATCH /api/orders/items/:itemId/status
  updateItemStatus: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status } = req.body;
      const allowed = ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: "status must be CONFIRMED, SHIPPED, DELIVERED, or CANCELLED",
        });
      }

      const item = await orderService.updateItemStatus(
        userId,
        String(req.params.itemId),
        status
      );
      return res.status(200).json({ message: "Item updated", item });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },
};