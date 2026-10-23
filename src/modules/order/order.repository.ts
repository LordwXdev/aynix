import { prisma, Db } from "../../shared/database/prisma.js";

type PaymentMethod = "CASH_ON_DELIVERY" | "MONCASH" | "NATCASH" | "BANK_TRANSFER";
export type ItemStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const toCents = (value: unknown) => Math.round(Number(value) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

// work out the whole order's status from its items
const statusFromItems = (statuses: ItemStatus[]): OrderStatus => {
  const live = statuses.filter((s) => s !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  if (live.every((s) => s === "DELIVERED")) return "DELIVERED";
  if (live.some((s) => s === "SHIPPED" || s === "DELIVERED")) return "SHIPPED";
  // delivery only starts once every store in the order has confirmed
  if (live.every((s) => s === "CONFIRMED")) return "CONFIRMED";
  return "PENDING";
};

const orderSummary = {
  id: true,
  orderNumber: true,
  customerId: true,
  status: true,
} as const;

export const orderRepository = {
  findProductsByIds: async (ids: string[]) => {
    return prisma.product.findMany({
      where: { id: { in: ids } },
      include: { vendor: { select: { userId: true, status: true } } },
    });
  },

  // create the order and take the stock in ONE transaction
  // if anything fails, everything is undone
  createWithStock: async (data: {
    orderNumber: string;
    customerId: string;
    paymentMethod: PaymentMethod;
    subtotal: string;
    deliveryFee: string;
    total: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryDepartment: string;
    deliveryNotes?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    items: {
      productId: string;
      vendorId: string;
      productName: string;
      unitPrice: string;
      quantity: number;
      lineTotal: string;
      commissionRate: string;
      commissionAmount: string;
      vendorPayout: string;
    }[];
  }) => {
    const { items, ...orderData } = data;

    return prisma.$transaction(async (tx) => {
      for (const item of items) {
        // only takes stock if enough is left, so two buyers cannot oversell
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            status: "ACTIVE",
            stockQty: { gte: item.quantity },
          },
          data: { stockQty: { decrement: item.quantity } },
        });

        if (result.count === 0) {
          throw new Error(`Not enough stock for ${item.productName}`);
        }
      }

      return tx.order.create({
        data: { ...orderData, items: { create: items } },
        include: { items: true },
      });
    });
  },

  listByCustomer: async (customerId: string) => {
    return prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: { items: true, delivery: { select: { status: true } } },
    });
  },

  findById: async (id: string) => {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        delivery: {
          include: {
            driver: {
              select: {
                id: true,
                userId: true,
                vehicleType: true,
                plateNumber: true,
                latitude: true,
                longitude: true,
                lastSeenAt: true,
                user: { select: { name: true, phone: true } },
              },
            },
          },
        },
      },
    });
  },

  findForCustomer: async (id: string, customerId: string) => {
    return prisma.order.findFirst({
      where: { id, customerId },
      include: { items: true, delivery: { select: { status: true } } },
    });
  },

  // the vendor sees only their own items, plus what they need to deliver
  listItemsForVendor: async (vendorId: string, status?: ItemStatus) => {
    return prisma.orderItem.findMany({
      where: { vendorId, ...(status ? { status } : {}) },
      orderBy: { order: { createdAt: "desc" } },
      include: {
        order: {
          select: {
            orderNumber: true,
            paymentMethod: true,
            deliveryAddress: true,
            deliveryCity: true,
            deliveryDepartment: true,
            deliveryNotes: true,
            createdAt: true,
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });
  },

  // sales numbers for a vendor dashboard
  vendorSales: async (vendorId: string) => {
    const [byStatus, delivered] = await Promise.all([
      prisma.orderItem.groupBy({
        by: ["status"],
        where: { vendorId },
        _count: { _all: true },
      }),
      prisma.orderItem.aggregate({
        where: { vendorId, status: "DELIVERED" },
        _sum: { lineTotal: true, commissionAmount: true, vendorPayout: true, quantity: true },
      }),
    ]);
    return { byStatus, delivered };
  },

  findItemById: async (id: string) => {
    return prisma.orderItem.findUnique({ where: { id } });
  },

  // look at all items of an order and save the order status, totals and payment
  // returns the order before and after so the caller can tell what changed
  syncOrderStatus: async (db: Db, orderId: string) => {
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { ...orderSummary, deliveryFee: true, paymentMethod: true },
    });
    const items = await db.orderItem.findMany({
      where: { orderId },
      select: { status: true, lineTotal: true },
    });

    const status = statusFromItems(items.map((i) => i.status as ItemStatus));

    // cancelled items are not paid for
    const subtotalCents = items
      .filter((i) => i.status !== "CANCELLED")
      .reduce((sum, i) => sum + toCents(i.lineTotal), 0);
    const feeCents = status === "CANCELLED" ? 0 : toCents(order.deliveryFee);

    await db.order.update({
      where: { id: orderId },
      data: {
        status,
        subtotal: fromCents(subtotalCents),
        total: fromCents(subtotalCents + feeCents),
        // cash on delivery is paid when the driver hands it over
        ...(status === "DELIVERED" && order.paymentMethod === "CASH_ON_DELIVERY"
          ? { paymentStatus: "PAID" as const }
          : {}),
      },
    });

    return { before: order.status as OrderStatus, after: status, order };
  },

  // change one item's status, put stock back if cancelled,
  // then update the whole order's status
  updateItemStatus: async (
    itemId: string,
    fromStatus: ItemStatus,
    toStatus: ItemStatus
  ) => {
    return prisma.$transaction(async (tx) => {
      // only works if the status is still what we expect
      const changed = await tx.orderItem.updateMany({
        where: { id: itemId, status: fromStatus },
        data: { status: toStatus },
      });
      if (changed.count === 0) {
        throw new Error("This item was already updated, please refresh");
      }

      const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId } });

      if (toStatus === "CANCELLED") {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }

      const sync = await orderRepository.syncOrderStatus(tx, item.orderId);
      return { item, sync };
    });
  },

  // move every item of an order that is in one of `from` to `to`
  // used by the delivery service when the driver picks up or drops off
  moveItems: async (
    db: Db,
    orderId: string,
    from: ItemStatus[],
    to: ItemStatus
  ) => {
    await db.orderItem.updateMany({
      where: { orderId, status: { in: from } },
      data: { status: to },
    });
    return orderRepository.syncOrderStatus(db, orderId);
  },

  // cancel every item that has not left the store yet and give the stock back
  cancelOpenItems: async (db: Db, orderId: string) => {
    const open = await db.orderItem.findMany({
      where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
    });

    for (const item of open) {
      const changed = await db.orderItem.updateMany({
        where: { id: item.id, status: item.status },
        data: { status: "CANCELLED" },
      });
      if (changed.count === 1) {
        await db.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }

    return orderRepository.syncOrderStatus(db, orderId);
  },
};
