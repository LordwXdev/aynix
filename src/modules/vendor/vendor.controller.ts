import { Request, Response } from "express";
import { vendorService } from "./vendor.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

const optionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() : undefined;

const optionalNumber = (value: unknown) =>
  value === undefined || value === null || value === "" ? undefined : Number(value);

// pull the store fields a vendor is allowed to set out of the request body
const readStoreDetails = (body: Record<string, unknown>) => ({
  description: optionalString(body.description),
  whatsapp: optionalString(body.whatsapp),
  logoUrl: optionalString(body.logoUrl),
  address: optionalString(body.address),
  city: optionalString(body.city),
  department: optionalString(body.department),
  latitude: optionalNumber(body.latitude),
  longitude: optionalNumber(body.longitude),
});

export const vendorController = {
  // create a store for the logged-in user
  createStore: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const body = req.body ?? {};
      const storeName = optionalString(body.storeName);

      if (!storeName) {
        return res.status(400).json({ error: "storeName is required" });
      }

      const vendor = await vendorService.createStore({
        userId,
        storeName,
        ...readStoreDetails(body),
      });

      return res.status(201).json({
        // the role inside the old access token is now out of date
        message: "Store created successfully. Refresh your token to get vendor access.",
        vendor,
      });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
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
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // PATCH /api/vendors/me
  updateMyStore: async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body ?? {};
      const vendor = await vendorService.updateMyStore(req.user!.userId, {
        storeName: optionalString(body.storeName),
        ...readStoreDetails(body),
      });
      return res.status(200).json({ message: "Store updated", vendor });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/vendors/:slug  (public)
  getPublicStore: async (req: Request, res: Response) => {
    try {
      const store = await vendorService.getPublicStore(String(req.params.slug));
      return res.status(200).json({ store });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },
};
