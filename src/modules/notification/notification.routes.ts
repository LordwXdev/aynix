import { Router, Response } from "express";
import { notificationService } from "./notification.service.js";
import { requireAuth, AuthRequest } from "../../shared/middleware/auth.js";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

// GET /api/notifications?page=1&limit=20
notificationRoutes.get("/", async (req: AuthRequest, res: Response) => {
  const result = await notificationService.listMine(
    req.user!.userId,
    Number(req.query.page) || 1,
    Number(req.query.limit) || 20
  );
  res.json(result);
});

// POST /api/notifications/read-all
notificationRoutes.post("/read-all", async (req: AuthRequest, res: Response) => {
  res.json(await notificationService.markAllRead(req.user!.userId));
});

// PATCH /api/notifications/:id/read
notificationRoutes.patch("/:id/read", async (req: AuthRequest, res: Response) => {
  res.json(await notificationService.markRead(req.user!.userId, String(req.params.id)));
});
