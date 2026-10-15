import { notificationRepository } from "./notification.repository.js";
import { realtimeHub } from "../../shared/realtime/hub.js";
import { sms } from "../../shared/sms/sms.js";

export interface NewNotification {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  // also send a text message (for things people must not miss)
  sms?: boolean;
}

export const notificationService = {
  // save it, push it live to the app, and text it if needed
  // push notifications (Firebase / Expo) plug in here later
  send: async (userId: string, input: NewNotification) => {
    const notification = await notificationRepository.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    });

    realtimeHub.toUser(userId, "notification", notification);

    if (input.sms) {
      const phone = await notificationRepository.findUserPhone(userId);
      if (phone) {
        await sms.send(phone, `Aynix: ${input.body}`);
      }
    }

    return notification;
  },

  listMine: async (userId: string, page: number, limit: number) => {
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    const result = await notificationRepository.listForUser(userId, (page - 1) * limit, limit);
    return { ...result, page, limit };
  },

  markRead: async (userId: string, id: string) => {
    const count = await notificationRepository.markRead(userId, id);
    return { updated: count };
  },

  markAllRead: async (userId: string) => {
    const count = await notificationRepository.markAllRead(userId);
    return { updated: count };
  },
};
