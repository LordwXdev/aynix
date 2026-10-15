import crypto from "node:crypto";
import { Response, NextFunction } from "express";
import { prisma } from "../database/prisma.js";
import { AuthRequest } from "./auth.js";
import { logger } from "../logger.js";

const IN_PROGRESS = 0;
const STALE_MS = 60_000;

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && err.code === "P2002";

/**
 * Makes a POST safe to retry.
 * The app sends a random "Idempotency-Key" header, the same one for every retry of one action.
 * - first time: we run the request and remember the answer
 * - same key again: we send back the remembered answer, nothing runs twice
 * - same key while the first is still running: 409, try again in a moment
 * - same key with a different body: 422, that's a mistake in the app
 * Use after requireAuth. Requests without the header work as before.
 */
export const idempotent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const key = req.header("Idempotency-Key");
  const userId = req.user?.userId;
  if (!key || !userId) return next();

  if (key.length > 100) {
    return res.status(400).json({ error: "Idempotency-Key is too long" });
  }

  const requestHash = crypto
    .createHash("sha256")
    .update(`${req.method} ${req.baseUrl}${req.path} ${JSON.stringify(req.body ?? {})}`)
    .digest("hex");

  // claim the key first: the unique (user, key) rule makes two parallel requests impossible
  try {
    await prisma.idempotencyKey.create({
      data: { userId, key, requestHash, statusCode: IN_PROGRESS, response: {} },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    const saved = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
    if (!saved) return res.status(409).json({ error: "Please try again" });
    if (saved.requestHash !== requestHash) {
      return res.status(422).json({ error: "This Idempotency-Key was already used for a different request" });
    }
    if (saved.statusCode === IN_PROGRESS) {
      // stuck for over a minute: the first try died (server restart). free the key for the next retry
      if (Date.now() - saved.createdAt.getTime() > STALE_MS) {
        await prisma.idempotencyKey.delete({ where: { id: saved.id } }).catch(() => {});
      }
      return res.status(409).json({ error: "This request is still being processed, try again in a moment" });
    }
    res.setHeader("Idempotent-Replayed", "true");
    return res.status(saved.statusCode).json(saved.response);
  }

  // remember the answer when the route sends it
  const send = res.json.bind(res);
  res.json = (body: unknown) => {
    const statusCode = res.statusCode;
    const done =
      statusCode >= 500
        ? // a server error might work next time: forget the key so a retry runs again
          prisma.idempotencyKey.delete({ where: { userId_key: { userId, key } } })
        : prisma.idempotencyKey.update({
            where: { userId_key: { userId, key } },
            data: { statusCode, response: (body ?? {}) as object },
          });
    done.catch((err) => logger.error({ err, key }, "could not save idempotency result"));
    return send(body);
  };

  next();
};
