import { prisma, Db } from "../../shared/database/prisma.js";

export type DeliveryStatus =
  | "WAITING_FOR_DRIVER"
  | "ASSIGNED"
  | "PICKED_UP"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

// everything a driver needs to do the job: where to pick up, where to drop off
const jobDetails = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      status: true,
      total: true,
      paymentMethod: true,
      deliveryAddress: true,
      deliveryCity: true,
      deliveryDepartment: true,
      deliveryNotes: true,
      deliveryLatitude: true,
      deliveryLongitude: true,
      customer: { select: { name: true, phone: true } },
      items: {
        where: { status: { not: "CANCELLED" as const } },
        select: {
          id: true,
          productName: true,
          quantity: true,
          status: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              whatsapp: true,
              address: true,
              city: true,
              latitude: true,
              longitude: true,
              user: { select: { phone: true } },
            },
          },
        },
      },
    },
  },
} as const;

export const deliveryRepository = {
  // one delivery per order, calling this twice is safe
  createForOrder: async (orderId: string) => {
    const existing = await prisma.delivery.findUnique({ where: { orderId } });
    if (existing) return existing;
    try {
      return await prisma.delivery.create({ data: { orderId } });
    } catch {
      // another request created it at the same moment
      return prisma.delivery.findUniqueOrThrow({ where: { orderId } });
    }
  },

  findById: async (id: string) => {
    return prisma.delivery.findUnique({
      where: { id },
      include: { ...jobDetails, driver: { select: { id: true, userId: true } } },
    });
  },

  findByOrderId: async (orderId: string) => {
    return prisma.delivery.findUnique({
      where: { orderId },
      include: { driver: { select: { id: true, userId: true } } },
    });
  },

  // oldest first, so nobody waits forever
  findWaitingIds: async () => {
    const rows = await prisma.delivery.findMany({
      where: { status: "WAITING_FOR_DRIVER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: 100,
    });
    return rows.map((r) => r.id);
  },

  listForDriver: async (driverId: string, statuses?: DeliveryStatus[]) => {
    return prisma.delivery.findMany({
      where: { driverId, ...(statuses ? { status: { in: statuses } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: jobDetails,
    });
  },

  list: async (filters: { status?: DeliveryStatus; skip: number; take: number }) => {
    const where = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        include: {
          order: {
            select: {
              orderNumber: true,
              deliveryCity: true,
              deliveryDepartment: true,
              total: true,
            },
          },
          driver: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              lastSeenAt: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      }),
      prisma.delivery.count({ where }),
    ]);
    return { items, total };
  },

  // does this driver already have a job in progress
  driverIsBusy: async (db: Db, driverId: string, exceptDeliveryId?: string) => {
    const count = await db.delivery.count({
      where: {
        driverId,
        status: { in: ["ASSIGNED", "PICKED_UP"] },
        ...(exceptDeliveryId ? { id: { not: exceptDeliveryId } } : {}),
      },
    });
    return count > 0;
  },

  // move a delivery from one status to another, only if nobody changed it first
  // returns false if the delivery was not in an expected status
  transition: async (
    db: Db,
    id: string,
    from: DeliveryStatus[],
    data: {
      status: DeliveryStatus;
      driverId?: string | null;
      assignedAt?: Date | null;
      pickedUpAt?: Date | null;
      deliveredAt?: Date;
      failReason?: string | null;
      declinedDriverIds?: { push: string };
    },
    onlyForDriverId?: string
  ) => {
    const result = await db.delivery.updateMany({
      where: {
        id,
        status: { in: from },
        ...(onlyForDriverId ? { driverId: onlyForDriverId } : {}),
      },
      data,
    });
    return result.count === 1;
  },
};
