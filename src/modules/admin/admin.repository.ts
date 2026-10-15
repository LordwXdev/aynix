import { prisma } from "../../shared/database/prisma.js";

type Role = "CUSTOMER" | "VENDOR" | "DRIVER" | "ADMIN";
type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

// the admin panel reads across the whole system, so it has its own read queries
export const adminRepository = {
  stats: async (since: Date) => {
    const [
      usersByRole,
      vendorsByStatus,
      driversByStatus,
      driversOnline,
      ordersByStatus,
      deliveriesByStatus,
      deliveredMoney,
      ordersToday,
      salesToday,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.vendor.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.driver.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.driver.count({ where: { isOnline: true, status: "ACTIVE" } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.delivery.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.orderItem.aggregate({
        where: { status: "DELIVERED" },
        _sum: { lineTotal: true, commissionAmount: true, vendorPayout: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
        _sum: { total: true },
      }),
    ]);

    return {
      usersByRole,
      vendorsByStatus,
      driversByStatus,
      driversOnline,
      ordersByStatus,
      deliveriesByStatus,
      deliveredMoney,
      ordersToday,
      salesToday,
    };
  },

  // orders per day for the chart on the dashboard
  dailyOrders: async (since: Date) => {
    return prisma.$queryRaw<{ day: Date; orders: bigint; sales: string | null }[]>`
      SELECT date_trunc('day', created_at) AS day,
             COUNT(*) AS orders,
             SUM(total) FILTER (WHERE status <> 'CANCELLED') AS sales
      FROM orders
      WHERE created_at >= ${since}
      GROUP BY 1
      ORDER BY 1`;
  },

  topVendors: async (take: number) => {
    const rows = await prisma.orderItem.groupBy({
      by: ["vendorId"],
      where: { status: "DELIVERED" },
      _sum: { lineTotal: true, commissionAmount: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take,
    });
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: rows.map((r) => r.vendorId) } },
      select: { id: true, storeName: true, storeSlug: true },
    });
    const byId = new Map(vendors.map((v) => [v.id, v]));
    return rows.map((r) => ({
      vendor: byId.get(r.vendorId),
      sales: r._sum.lineTotal ?? "0",
      commission: r._sum.commissionAmount ?? "0",
    }));
  },

  listUsers: async (filters: { role?: Role; q?: string; skip: number; take: number }) => {
    const where = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { phone: { contains: filters.q } },
              { email: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        omit: { passwordHash: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  findUser: async (id: string) => {
    return prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
  },

  setUserActive: async (id: string, isActive: boolean) => {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      omit: { passwordHash: true },
    });
  },

  listOrders: async (filters: { status?: OrderStatus; q?: string; skip: number; take: number }) => {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { orderNumber: { contains: filters.q, mode: "insensitive" as const } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        include: {
          customer: { select: { name: true, phone: true } },
          delivery: { select: { status: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },

  findOrder: async (id: string) => {
    return prisma.order.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: { include: { vendor: { select: { storeName: true, storeSlug: true } } } },
        delivery: {
          include: {
            driver: { include: { user: { select: { name: true, phone: true } } } },
          },
        },
      },
    });
  },

  listDeadLetters: async (filters: { resolved: boolean; skip: number; take: number }) => {
    const where = { resolvedAt: filters.resolved ? { not: null } : null };
    const [items, total] = await Promise.all([
      prisma.deadLetter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.deadLetter.count({ where }),
    ]);
    return { items, total };
  },

  findDeadLetter: async (id: string) => prisma.deadLetter.findUnique({ where: { id } }),

  resolveDeadLetter: async (id: string) =>
    prisma.deadLetter.update({ where: { id }, data: { resolvedAt: new Date() } }),

  failDeadLetterAgain: async (id: string, error: string) =>
    prisma.deadLetter.update({ where: { id }, data: { error, attempts: { increment: 1 } } }),
};
