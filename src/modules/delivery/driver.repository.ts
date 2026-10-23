import { prisma } from "../../shared/database/prisma.js";

export type DriverStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
export type VehicleType = "MOTO" | "CAR" | "BICYCLE" | "FOOT";

// a driver counts as busy while a delivery is in one of these states
export const ACTIVE_DELIVERY_STATUSES = ["ASSIGNED", "PICKED_UP"] as const;

export const driverRepository = {
  findByUserId: async (userId: string) => {
    return prisma.driver.findUnique({ where: { userId } });
  },

  findById: async (id: string) => {
    return prisma.driver.findUnique({ where: { id } });
  },

  // create the driver profile and switch the account to DRIVER, both or nothing
  create: async (data: {
    userId: string;
    vehicleType: VehicleType;
    plateNumber?: string;
    city: string;
    department: string;
  }) => {
    return prisma.$transaction(async (tx) => {
      const driver = await tx.driver.create({ data });
      await tx.user.update({ where: { id: data.userId }, data: { role: "DRIVER" } });
      return driver;
    });
  },

  update: async (
    id: string,
    data: {
      isOnline?: boolean;
      latitude?: number;
      longitude?: number;
      lastSeenAt?: Date;
      status?: DriverStatus;
      vehicleType?: VehicleType;
      plateNumber?: string;
      city?: string;
      department?: string;
    }
  ) => {
    return prisma.driver.update({ where: { id }, data });
  },

  // order ids this driver is carrying right now (for live tracking)
  activeOrderIds: async (driverId: string) => {
    const rows = await prisma.delivery.findMany({
      where: { driverId, status: { in: [...ACTIVE_DELIVERY_STATUSES] } },
      select: { orderId: true },
    });
    return rows.map((r) => r.orderId);
  },

  // drivers who could take a job right now in this department
  findAvailable: async (filters: { department: string; seenSince: Date; excludeIds: string[] }) => {
    return prisma.driver.findMany({
      where: {
        status: "ACTIVE",
        isOnline: true,
        lastSeenAt: { gte: filters.seenSince },
        department: { equals: filters.department.trim(), mode: "insensitive" },
        id: { notIn: filters.excludeIds },
        user: { isActive: true },
        deliveries: { none: { status: { in: [...ACTIVE_DELIVERY_STATUSES] } } },
      },
    });
  },

  list: async (filters: {
    status?: DriverStatus;
    online?: boolean;
    skip: number;
    take: number;
  }) => {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.online !== undefined ? { isOnline: filters.online } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        include: {
          user: { select: { name: true, phone: true, isActive: true } },
          _count: { select: { deliveries: { where: { status: "DELIVERED" } } } },
        },
      }),
      prisma.driver.count({ where }),
    ]);
    return { items, total };
  },
};
