import type { Server } from "socket.io";

// the socket server is created in app.ts, any module can push through here
// if it is not started (for example in a script), sending does nothing
let io: Server | null = null;

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  order: (orderId: string) => `order:${orderId}`,
  admins: "admins",
};

export const realtimeHub = {
  attach(server: Server) {
    io = server;
  },

  toUser(userId: string, event: string, data: unknown) {
    io?.to(rooms.user(userId)).emit(event, data);
  },

  toOrder(orderId: string, event: string, data: unknown) {
    io?.to(rooms.order(orderId)).emit(event, data);
  },

  toAdmins(event: string, data: unknown) {
    io?.to(rooms.admins).emit(event, data);
  },
};
