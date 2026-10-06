import { prisma } from "../../shared/database/prisma.js";

type PaymentMethod = "CASH_ON_DELIVERY" | "MONCASH" | "NATCASH" | "BANK_TRANSFER";
type ItemStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export const orderRepository = {
  findProductsByIds: async (ids: string[]) => {
    return prisma.product.findMany({
      where: { id: { in: ids } },
      include: { vendor: { select: { userId: true } } },
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
      include: { items: true },
    });
  },

  findForCustomer: async (id: string, customerId: string) => {
    return prisma.order.findFirst({
      where: { id, customerId },
      include: { items: true },
    });
  },

  // the vendor sees only their own items, plus what they need to deliver
  listItemsForVendor: async (vendorId: string) => {
    return prisma.orderItem.findMany({
      where: { vendorId },
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
            customer: { select: { name: true, phone: true } },
          },
        },
      },
    });
  },

  findItemById: async (id: string) => {
    return prisma.orderItem.findUnique({ where: { id } });
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

      const all = await tx.orderItem.findMany({
        where: { orderId: item.orderId },
        select: { status: true },
      });
      const statuses = all.map((i) => i.status);

      let orderStatus: OrderStatus = "PENDING";
      if (statuses.every((s) => s === "CANCELLED")) {
        orderStatus = "CANCELLED";
      } else if (statuses.every((s) => s === "DELIVERED" || s === "CANCELLED")) {
        orderStatus = "DELIVERED";
      } else if (statuses.some((s) => s === "SHIPPED" || s === "DELIVERED")) {
        orderStatus = "SHIPPED";
      } else if (statuses.some((s) => s === "CONFIRMED")) {
        orderStatus = "CONFIRMED";
      }

      await tx.order.update({
        where: { id: item.orderId },
        data: {
          status: orderStatus,
          // cash on delivery is paid when everything is delivered
          ...(orderStatus === "DELIVERED" ? { paymentStatus: "PAID" as const } : {}),
        },
      });

      return item;
    });
  },
};