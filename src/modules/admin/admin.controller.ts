import { Response } from "express";
import { AuthRequest } from "../../shared/middleware/auth.js";
import { adminService } from "./admin.service.js";
import { vendorService } from "../vendor/vendor.service.js";
import { driverService } from "../delivery/driver.service.js";
import { deliveryService } from "../delivery/delivery.service.js";
import { orderService } from "../order/order.service.js";
import { categoryService } from "../market/category.service.js";
import { badRequest, notFound } from "../../shared/errors.js";

const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);
const page = (req: AuthRequest) => Number(req.query.page) || 1;
const limit = (req: AuthRequest) => Number(req.query.limit) || 20;

// turn plain service errors into 400s so the error handler shows the message
const run = async <T>(work: () => Promise<T>, status: 400 | 404 = 400): Promise<T> => {
  try {
    return await work();
  } catch (err) {
    if (err instanceof Error && !("code" in err)) {
      throw status === 404 ? notFound(err.message) : badRequest(err.message);
    }
    throw err;
  }
};

export const adminController = {
  dashboard: async (req: AuthRequest, res: Response) => {
    res.json(await adminService.dashboard());
  },

  // --- users ---
  listUsers: async (req: AuthRequest, res: Response) => {
    res.json(
      await run(() =>
        adminService.listUsers({
          role: str(req.query.role),
          q: str(req.query.q),
          page: page(req),
          limit: limit(req),
        })
      )
    );
  },

  setUserActive: async (req: AuthRequest, res: Response) => {
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      throw badRequest("isActive must be true or false");
    }
    const user = await run(() =>
      adminService.setUserActive(req.user!.userId, String(req.params.id), isActive)
    );
    res.json({ user });
  },

  // --- vendors ---
  listVendors: async (req: AuthRequest, res: Response) => {
    res.json(
      await run(() =>
        vendorService.listStores({ status: str(req.query.status), page: page(req), limit: limit(req) })
      )
    );
  },

  setVendorStatus: async (req: AuthRequest, res: Response) => {
    const vendor = await run(() =>
      vendorService.setStatus(String(req.params.id), String(req.body?.status))
    );
    res.json({ vendor });
  },

  // --- drivers ---
  listDrivers: async (req: AuthRequest, res: Response) => {
    const online =
      req.query.online === "true" ? true : req.query.online === "false" ? false : undefined;
    res.json(
      await run(() =>
        driverService.list({ status: str(req.query.status), online, page: page(req), limit: limit(req) })
      )
    );
  },

  setDriverStatus: async (req: AuthRequest, res: Response) => {
    const driver = await run(() =>
      driverService.setStatus(String(req.params.id), String(req.body?.status))
    );
    res.json({ driver });
  },

  // --- orders ---
  listOrders: async (req: AuthRequest, res: Response) => {
    res.json(
      await run(() =>
        adminService.listOrders({
          status: str(req.query.status),
          q: str(req.query.q),
          page: page(req),
          limit: limit(req),
        })
      )
    );
  },

  getOrder: async (req: AuthRequest, res: Response) => {
    const order = await run(() => adminService.getOrder(String(req.params.id)), 404);
    res.json({ order });
  },

  cancelOrder: async (req: AuthRequest, res: Response) => {
    const order = await run(() => orderService.cancelOrder(String(req.params.id)));
    res.json({ message: "Order cancelled", order });
  },

  setItemStatus: async (req: AuthRequest, res: Response) => {
    const status = req.body?.status;
    if (status !== "CONFIRMED" && status !== "CANCELLED") {
      throw badRequest("status must be CONFIRMED or CANCELLED");
    }
    const item = await run(() =>
      orderService.adminUpdateItemStatus(String(req.params.itemId), status)
    );
    res.json({ item });
  },

  // --- deliveries ---
  listDeliveries: async (req: AuthRequest, res: Response) => {
    res.json(
      await run(() =>
        deliveryService.list({ status: str(req.query.status), page: page(req), limit: limit(req) })
      )
    );
  },

  assignDriver: async (req: AuthRequest, res: Response) => {
    const driverId = str(req.body?.driverId);
    if (!driverId) {
      throw badRequest("driverId is required");
    }
    const delivery = await run(() => deliveryService.adminAssign(String(req.params.id), driverId));
    res.json({ delivery });
  },

  autoAssign: async (req: AuthRequest, res: Response) => {
    const driverId = await deliveryService.autoAssign(String(req.params.id));
    res.json({ assigned: driverId !== null, driverId });
  },

  // --- categories ---
  listCategories: async (req: AuthRequest, res: Response) => {
    res.json({ categories: await categoryService.listAll() });
  },

  createCategory: async (req: AuthRequest, res: Response) => {
    const name = str(req.body?.name);
    if (!name) {
      throw badRequest("name is required");
    }
    const category = await run(() =>
      categoryService.create({
        name,
        parentId: str(req.body?.parentId),
        sortOrder: req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined,
      })
    );
    res.status(201).json({ category });
  },

  updateCategory: async (req: AuthRequest, res: Response) => {
    const body = req.body ?? {};
    const category = await run(() =>
      categoryService.update(String(req.params.id), {
        name: str(body.name),
        parentId: body.parentId === null ? null : str(body.parentId),
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      })
    );
    res.json({ category });
  },

  // --- dead letters ---
  listDeadLetters: async (req: AuthRequest, res: Response) => {
    res.json(
      await adminService.listDeadLetters({
        resolved: req.query.resolved === "true",
        page: page(req),
        limit: limit(req),
      })
    );
  },

  retryDeadLetter: async (req: AuthRequest, res: Response) => {
    const letter = await run(() => adminService.retryDeadLetter(String(req.params.id)));
    res.json({ letter });
  },

  resolveDeadLetter: async (req: AuthRequest, res: Response) => {
    const letter = await run(() => adminService.resolveDeadLetter(String(req.params.id)), 404);
    res.json({ letter });
  },
};
