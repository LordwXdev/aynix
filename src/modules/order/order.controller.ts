import { Response } from "express";
import { orderService } from "./order.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

const optionalNumber = (value: unknown) =>
  value === undefined || value === null || value === "" ? undefined : Number(value);

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
        deliveryLatitude,
        deliveryLongitude,
        paymentMethod,
      } = req.body ?? {};

      if (!Array.isArray(items) || !deliveryAddress || !deliveryCity || !deliveryDepartment) {
        return res.status(400).json({
          error: "items, deliveryAddress, deliveryCity, and deliveryDepartment are required",
        });
      }

      const order = await orderService.createOrder({
        customerId: userId,
        items,
        deliveryAddress: String(deliveryAddress),
        deliveryCity: String(deliveryCity),
        deliveryDepartment: String(deliveryDepartment),
        deliveryNotes: deliveryNotes ? String(deliveryNotes) : undefined,
        deliveryLatitude: optionalNumber(deliveryLatitude),
        deliveryLongitude: optionalNumber(deliveryLongitude),
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

  // GET /api/orders/:id/tracking
  tracking: async (req: AuthRequest, res: Response) => {
    try {
      const tracking = await orderService.getTracking(req.user!.userId, String(req.params.id));
      return res.status(200).json({ tracking });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // POST /api/orders/:id/cancel
  cancel: async (req: AuthRequest, res: Response) => {
    try {
      const order = await orderService.cancelMyOrder(req.user!.userId, String(req.params.id));
      return res.status(200).json({ message: "Order cancelled", order });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/orders/vendor/items?status=PENDING
  vendorItems: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const items = await orderService.listVendorItems(userId, status);
      return res.status(200).json({ items });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/orders/vendor/sales
  vendorSales: async (req: AuthRequest, res: Response) => {
    try {
      const sales = await orderService.vendorSales(req.user!.userId);
      return res.status(200).json({ sales });
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

      const { status } = req.body ?? {};
      const allowed = ["CONFIRMED", "CANCELLED"];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: "status must be CONFIRMED or CANCELLED (the driver handles shipping and delivery)",
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
