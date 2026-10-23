import { orderRepository, ItemStatus } from "./order.repository.js";
import { vendorService } from "../vendor/vendor.service.js";
import { eventBus } from "../../shared/events/event-bus.js";
import { env } from "../../config/env.js";
import { isValidLatLng } from "../../shared/utils/geo.js";
import { prisma } from "../../shared/database/prisma.js";

// basis points: 1000 = 10%. later this will come from the vendor plan
const COMMISSION_BPS = Math.round(env.commissionPercent * 100);

// the steps a vendor is allowed to take
// shipping and delivering are done by the driver, not the vendor
const VENDOR_NEXT_STATUS: Record<ItemStatus, ItemStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  SHIPPED: [],
  DELIVERED: [],
  CANCELLED: [],
};

// we do the money math in cents (whole numbers) to avoid rounding errors
const toCents = (value: unknown) => Math.round(Number(value) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

type SyncResult = Awaited<ReturnType<typeof orderRepository.syncOrderStatus>>;

// tell the rest of the system when an order's status really changed
export const announceOrderChange = (sync: SyncResult) => {
  if (sync.before !== sync.after) {
    eventBus.emit("order.status_changed", {
      orderId: sync.order.id,
      orderNumber: sync.order.orderNumber,
      customerId: sync.order.customerId,
      status: sync.after,
    });
  }
};

export const orderService = {
  createOrder: async (input: {
    customerId: string;
    items: { productId: string; quantity: number }[];
    deliveryAddress: string;
    deliveryCity: string;
    deliveryDepartment: string;
    deliveryNotes?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    paymentMethod: string;
  }) => {
    // for now only cash on delivery is open
    if (input.paymentMethod !== "CASH_ON_DELIVERY") {
      throw new Error("Only cash on delivery is available right now");
    }

    if (input.items.length === 0 || input.items.length > 50) {
      throw new Error("An order needs between 1 and 50 products");
    }

    const hasLat = input.deliveryLatitude !== undefined;
    const hasLng = input.deliveryLongitude !== undefined;
    if (hasLat !== hasLng || (hasLat && !isValidLatLng(input.deliveryLatitude, input.deliveryLongitude))) {
      throw new Error("Invalid delivery location");
    }

    // merge repeated products into one line
    const wanted = new Map<string, number>();
    for (const item of input.items) {
      if (!item?.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error("Each item needs a productId and a whole quantity of 1 or more");
      }
      wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity);
    }

    const products = await orderRepository.findProductsByIds([...wanted.keys()]);
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotalCents = 0;
    const lines = [];

    for (const [productId, quantity] of wanted) {
      const product = byId.get(productId);

      if (!product || product.status !== "ACTIVE" || product.vendor.status !== "ACTIVE") {
        throw new Error("One of the products is not available");
      }
      if (product.vendor.userId === input.customerId) {
        throw new Error("You cannot buy from your own store");
      }
      if (product.stockQty < quantity) {
        throw new Error(`Not enough stock for ${product.name}`);
      }

      const unitCents = toCents(product.price);
      const lineCents = unitCents * quantity;
      const commissionCents = Math.round((lineCents * COMMISSION_BPS) / 10000);

      subtotalCents += lineCents;

      lines.push({
        productId,
        vendorId: product.vendorId,
        productName: product.name,
        unitPrice: fromCents(unitCents),
        quantity,
        lineTotal: fromCents(lineCents),
        commissionRate: (COMMISSION_BPS / 100).toFixed(2),
        commissionAmount: fromCents(commissionCents),
        vendorPayout: fromCents(lineCents - commissionCents),
      });
    }

    const deliveryFeeCents = toCents(env.deliveryFee);
    const orderNumber = `AYX-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const order = await orderRepository.createWithStock({
      orderNumber,
      customerId: input.customerId,
      paymentMethod: "CASH_ON_DELIVERY",
      subtotal: fromCents(subtotalCents),
      deliveryFee: fromCents(deliveryFeeCents),
      total: fromCents(subtotalCents + deliveryFeeCents),
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryDepartment: input.deliveryDepartment,
      deliveryNotes: input.deliveryNotes,
      deliveryLatitude: input.deliveryLatitude,
      deliveryLongitude: input.deliveryLongitude,
      items: lines,
    });

    eventBus.emit("order.placed", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      vendorIds: [...new Set(order.items.map((i) => i.vendorId))],
    });

    return order;
  },

  listMyOrders: async (customerId: string) => {
    return orderRepository.listByCustomer(customerId);
  },

  getMyOrder: async (customerId: string, orderId: string) => {
    const order = await orderRepository.findForCustomer(orderId, customerId);
    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  },

  // customer: where is my order right now
  getTracking: async (customerId: string, orderId: string) => {
    const order = await orderRepository.findById(orderId);
    if (!order || order.customerId !== customerId) {
      throw new Error("Order not found");
    }

    const delivery = order.delivery;
    // only show the driver while they are actually on this job
    const driverVisible =
      delivery?.driver && (delivery.status === "ASSIGNED" || delivery.status === "PICKED_UP");

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      delivery: delivery
        ? {
            status: delivery.status,
            assignedAt: delivery.assignedAt,
            pickedUpAt: delivery.pickedUpAt,
            deliveredAt: delivery.deliveredAt,
            driver: driverVisible
              ? {
                  name: delivery.driver!.user.name,
                  phone: delivery.driver!.user.phone,
                  vehicleType: delivery.driver!.vehicleType,
                  plateNumber: delivery.driver!.plateNumber,
                  latitude: delivery.driver!.latitude,
                  longitude: delivery.driver!.longitude,
                  lastSeenAt: delivery.driver!.lastSeenAt,
                }
              : null,
          }
        : null,
    };
  },

  // customer: cancel an order that has not been picked up yet
  cancelMyOrder: async (customerId: string, orderId: string) => {
    const order = await orderRepository.findForCustomer(orderId, customerId);
    if (!order) {
      throw new Error("Order not found");
    }
    return orderService.cancelOrder(orderId);
  },

  // used by the customer and by admins
  cancelOrder: async (orderId: string) => {
    const sync = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new Error("Order not found");
      }
      if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
        throw new Error("This order can no longer be cancelled");
      }
      return orderRepository.cancelOpenItems(tx, orderId);
    });

    announceOrderChange(sync);
    return orderRepository.findById(orderId);
  },

  // vendor: see the items people bought from my store
  listVendorItems: async (userId: string, status?: string) => {
    const vendor = await vendorService.getMyStore(userId);
    const allowed: ItemStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (status && !allowed.includes(status as ItemStatus)) {
      throw new Error("Invalid status");
    }
    return orderRepository.listItemsForVendor(vendor.id, status as ItemStatus | undefined);
  },

  // vendor: sales dashboard numbers
  vendorSales: async (userId: string) => {
    const vendor = await vendorService.getMyStore(userId);
    const { byStatus, delivered } = await orderRepository.vendorSales(vendor.id);
    return {
      itemsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      delivered: {
        unitsSold: delivered._sum.quantity ?? 0,
        grossSales: delivered._sum.lineTotal ?? "0",
        commission: delivered._sum.commissionAmount ?? "0",
        payout: delivered._sum.vendorPayout ?? "0",
      },
    };
  },

  // vendor: confirm or cancel one item
  updateItemStatus: async (userId: string, itemId: string, newStatus: ItemStatus) => {
    const vendor = await vendorService.getMyStore(userId);

    const item = await orderRepository.findItemById(itemId);
    if (!item || item.vendorId !== vendor.id) {
      throw new Error("Order item not found");
    }

    return orderService.changeItemStatus(itemId, item.status as ItemStatus, newStatus, VENDOR_NEXT_STATUS);
  },

  // admin: confirm or cancel any item that has not left the store
  adminUpdateItemStatus: async (itemId: string, newStatus: ItemStatus) => {
    const item = await orderRepository.findItemById(itemId);
    if (!item) {
      throw new Error("Order item not found");
    }
    return orderService.changeItemStatus(itemId, item.status as ItemStatus, newStatus, VENDOR_NEXT_STATUS);
  },

  changeItemStatus: async (
    itemId: string,
    current: ItemStatus,
    newStatus: ItemStatus,
    rules: Record<ItemStatus, ItemStatus[]>
  ) => {
    if (!rules[current]?.includes(newStatus)) {
      throw new Error(`You cannot change an item from ${current} to ${newStatus}`);
    }

    const { item, sync } = await orderRepository.updateItemStatus(itemId, current, newStatus);

    eventBus.emit("order.item_status_changed", {
      orderId: item.orderId,
      itemId: item.id,
      vendorId: item.vendorId,
      status: newStatus,
    });
    announceOrderChange(sync);

    return item;
  },

  // who is allowed to watch this order live
  canViewOrder: async (userId: string, role: string, orderId: string) => {
    if (role === "ADMIN") return true;
    const order = await orderRepository.findById(orderId);
    if (!order) return false;
    if (order.customerId === userId) return true;
    if (order.delivery?.driver?.userId === userId) return true;
    if (role === "VENDOR") {
      const vendor = await vendorService.getMyStore(userId).catch(() => null);
      return !!vendor && order.items.some((i) => i.vendorId === vendor.id);
    }
    return false;
  },
};
