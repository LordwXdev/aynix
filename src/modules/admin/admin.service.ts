import { adminRepository } from "./admin.repository.js";
import { userService } from "../user/user.service.js";
import { driverService } from "../delivery/driver.service.js";
import { eventBus } from "../../shared/events/event-bus.js";

const ROLES = ["CUSTOMER", "VENDOR", "DRIVER", "ADMIN"] as const;
const ORDER_STATUS = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

// turn prisma groupBy rows into { STATUS: count }
const countMap = <K extends string>(rows: { _count: { _all: number } }[], key: K) =>
  Object.fromEntries(
    rows.map((r) => [(r as unknown as Record<K, string>)[key], r._count._all])
  );

const paging = (page: number, limit: number) => {
  page = Math.max(1, page);
  limit = Math.min(100, Math.max(1, limit));
  return { page, limit, skip: (page - 1) * limit };
};

export const adminService = {
  dashboard: async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [s, daily, topVendors] = await Promise.all([
      adminRepository.stats(startOfToday),
      adminRepository.dailyOrders(thirtyDaysAgo),
      adminRepository.topVendors(5),
    ]);

    return {
      users: countMap(s.usersByRole, "role"),
      vendors: countMap(s.vendorsByStatus, "status"),
      drivers: { ...countMap(s.driversByStatus, "status"), online: s.driversOnline },
      orders: countMap(s.ordersByStatus, "status"),
      deliveries: countMap(s.deliveriesByStatus, "status"),
      money: {
        deliveredSales: s.deliveredMoney._sum.lineTotal ?? "0",
        commissionEarned: s.deliveredMoney._sum.commissionAmount ?? "0",
        owedToVendors: s.deliveredMoney._sum.vendorPayout ?? "0",
      },
      today: {
        orders: s.ordersToday,
        sales: s.salesToday._sum.total ?? "0",
      },
      last30Days: daily.map((d) => ({
        day: d.day,
        orders: Number(d.orders),
        sales: d.sales ?? "0",
      })),
      topVendors,
    };
  },

  listUsers: async (input: { role?: string; q?: string; page: number; limit: number }) => {
    if (input.role && !ROLES.includes(input.role as (typeof ROLES)[number])) {
      throw new Error("Invalid role");
    }
    const { page, limit, skip } = paging(input.page, input.limit);
    const result = await adminRepository.listUsers({
      role: input.role as (typeof ROLES)[number] | undefined,
      q: input.q,
      skip,
      take: limit,
    });
    return { ...result, page, limit };
  },

  // ban or unban an account
  setUserActive: async (adminId: string, userId: string, isActive: boolean) => {
    if (adminId === userId) {
      throw new Error("You cannot ban yourself");
    }
    const user = await adminRepository.findUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const updated = await adminRepository.setUserActive(userId, isActive);
    if (!isActive) {
      // kick them out: no new tokens, and drivers stop getting jobs
      await userService.logoutEverywhere(userId);
      await driverService.goOffline(userId);
    }
    return updated;
  },

  listOrders: async (input: { status?: string; q?: string; page: number; limit: number }) => {
    if (input.status && !ORDER_STATUS.includes(input.status as (typeof ORDER_STATUS)[number])) {
      throw new Error("Invalid status");
    }
    const { page, limit, skip } = paging(input.page, input.limit);
    const result = await adminRepository.listOrders({
      status: input.status as (typeof ORDER_STATUS)[number] | undefined,
      q: input.q,
      skip,
      take: limit,
    });
    return { ...result, page, limit };
  },

  getOrder: async (orderId: string) => {
    const order = await adminRepository.findOrder(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  },

  // --- dead letters: events and texts that kept failing ---

  listDeadLetters: async (input: { resolved: boolean; page: number; limit: number }) => {
    const { page, limit, skip } = paging(input.page, input.limit);
    const result = await adminRepository.listDeadLetters({ resolved: input.resolved, skip, take: limit });
    return { ...result, page, limit };
  },

  // run the failed listener again with the same data
  retryDeadLetter: async (id: string) => {
    const letter = await adminRepository.findDeadLetter(id);
    if (!letter) throw new Error("Dead letter not found");
    if (letter.resolvedAt) throw new Error("This one is already resolved");
    try {
      await eventBus.replay(letter.handler, letter.payload);
      return adminRepository.resolveDeadLetter(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await adminRepository.failDeadLetterAgain(id, message);
      throw new Error(`Still failing: ${message}`);
    }
  },

  // mark as handled without running it again
  resolveDeadLetter: async (id: string) => {
    const letter = await adminRepository.findDeadLetter(id);
    if (!letter) throw new Error("Dead letter not found");
    return adminRepository.resolveDeadLetter(id);
  },
};
