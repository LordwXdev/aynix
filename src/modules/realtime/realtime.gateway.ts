import type { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken, TokenPayload } from "../../shared/middleware/auth.js";
import { realtimeHub, rooms } from "../../shared/realtime/hub.js";
import { orderService } from "../order/order.service.js";
import { driverService } from "../delivery/driver.service.js";
import { env } from "../../config/env.js";

type Ack = (response: { ok: boolean; error?: string }) => void;

// the app connects with:  io(URL, { auth: { token: accessToken } })
export const startRealtime = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins.includes("*") ? "*" : env.corsOrigins },
  });

  // check the token once, when the socket connects
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = typeof token === "string" ? verifyAccessToken(token) : null;
    if (!user) {
      return next(new Error("Invalid or expired token"));
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as TokenPayload;

    // everyone gets their own private room for notifications
    socket.join(rooms.user(user.userId));
    if (user.role === "ADMIN") {
      socket.join(rooms.admins);
    }

    // follow one order live (customer, its stores, its driver, or admin)
    socket.on("order:watch", async (payload: { orderId?: string }, ack?: Ack) => {
      const orderId = payload?.orderId;
      try {
        const allowed =
          typeof orderId === "string" &&
          (await orderService.canViewOrder(user.userId, user.role, orderId));
        if (!allowed) {
          return ack?.({ ok: false, error: "Order not found" });
        }
        socket.join(rooms.order(orderId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: "Something went wrong" });
      }
    });

    socket.on("order:unwatch", (payload: { orderId?: string }) => {
      if (typeof payload?.orderId === "string") {
        socket.leave(rooms.order(payload.orderId));
      }
    });

    // drivers can stream GPS over the socket instead of calling the REST route
    socket.on(
      "driver:location",
      async (payload: { latitude?: number; longitude?: number }, ack?: Ack) => {
        if (user.role !== "DRIVER") {
          return ack?.({ ok: false, error: "Only drivers can send a location" });
        }
        try {
          await driverService.updateLocation(
            user.userId,
            Number(payload?.latitude),
            Number(payload?.longitude)
          );
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : "Something went wrong" });
        }
      }
    );
  });

  realtimeHub.attach(io);
  return io;
};
