import { Response } from "express";
import { vendorService } from "./vendor.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

export const vendorController = {
  // create a store for the logged-in user
  createStore: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { storeName, description, whatsapp } = req.body;

      if (!storeName) {
        return res.status(400).json({ error: "storeName is required" });
      }

      const vendor = await vendorService.createStore({
        userId,
        storeName,
        description,
        whatsapp,
      });

      return res.status(201).json({
        message: "Store created successfully",
        vendor,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      return res.status(400).json({ error: message });
    }
  },

  // get the logged-in user's own store
  getMyStore: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const vendor = await vendorService.getMyStore(userId);

      return res.status(200).json({ vendor });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      return res.status(404).json({ error: message });
    }
  },
};
