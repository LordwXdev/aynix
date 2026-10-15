import { Response } from "express";
import { deliveryService } from "./delivery.service.js";
import { driverService } from "./driver.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

export const driverController = {
  // POST /api/drivers  -> apply to become a driver
  apply: async (req: AuthRequest, res: Response) => {
    try {
      const { vehicleType, plateNumber, city, department } = req.body ?? {};
      if (!vehicleType || !city || !department) {
        return res
          .status(400)
          .json({ error: "vehicleType, city, and department are required" });
      }
      const driver = await driverService.apply({
        userId: req.user!.userId,
        vehicleType: String(vehicleType),
        plateNumber: plateNumber ? String(plateNumber) : undefined,
        city: String(city),
        department: String(department),
      });
      return res.status(201).json({
        message: "Application sent. Refresh your token to get driver access.",
        driver,
      });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // GET /api/drivers/me
  me: async (req: AuthRequest, res: Response) => {
    try {
      const driver = await driverService.getMine(req.user!.userId);
      return res.status(200).json({ driver });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // PATCH /api/drivers/me/online  { isOnline: true }
  setOnline: async (req: AuthRequest, res: Response) => {
    try {
      const { isOnline } = req.body ?? {};
      if (typeof isOnline !== "boolean") {
        return res.status(400).json({ error: "isOnline must be true or false" });
      }
      const driver = await driverService.setOnline(req.user!.userId, isOnline);
      return res.status(200).json({ driver });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  // POST /api/drivers/me/location  { latitude, longitude }
  location: async (req: AuthRequest, res: Response) => {
    try {
      const { latitude, longitude } = req.body ?? {};
      await driverService.updateLocation(req.user!.userId, Number(latitude), Number(longitude));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },
};

export const deliveryController = {
  // GET /api/deliveries/mine?active=true
  mine: async (req: AuthRequest, res: Response) => {
    try {
      const deliveries = await deliveryService.listMine(
        req.user!.userId,
        req.query.active === "true"
      );
      return res.status(200).json({ deliveries });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  decline: async (req: AuthRequest, res: Response) => {
    try {
      const delivery = await deliveryService.decline(req.user!.userId, String(req.params.id));
      return res.status(200).json({ message: "Job declined", delivery });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  pickUp: async (req: AuthRequest, res: Response) => {
    try {
      const delivery = await deliveryService.pickUp(req.user!.userId, String(req.params.id));
      return res.status(200).json({ message: "Order picked up", delivery });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  deliver: async (req: AuthRequest, res: Response) => {
    try {
      const delivery = await deliveryService.deliver(req.user!.userId, String(req.params.id));
      return res.status(200).json({ message: "Order delivered", delivery });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  fail: async (req: AuthRequest, res: Response) => {
    try {
      const reason = String(req.body?.reason ?? "").trim();
      if (!reason) {
        return res.status(400).json({ error: "reason is required" });
      }
      const delivery = await deliveryService.fail(req.user!.userId, String(req.params.id), reason);
      return res.status(200).json({ message: "Delivery marked as failed", delivery });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },
};
