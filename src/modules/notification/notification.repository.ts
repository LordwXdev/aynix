import { prisma } from "../../shared/database/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export const notificationRepository = {
  create: async (data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Prisma.InputJsonValue;
  }) => {
    return prisma.notification.create({ data });
  },

  listForUser: async (userId: string, skip: number, take: number) => {
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unread };
  },

  markRead: async (userId: string, id: string) => {
    const result = await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  },

  markAllRead: async (userId: string) => {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  },

  saveFailedSms: async (phone: string, message: string, err: unknown) => {
    await prisma.deadLetter.create({
      data: {
        event: "sms.send",
        handler: "sms",
        payload: { phone, message },
        error: err instanceof Error ? err.message : String(err),
        attempts: 1,
      },
    });
  },

  findUserPhone: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  },
};
