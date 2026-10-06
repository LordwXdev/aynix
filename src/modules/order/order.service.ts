import { orderRepository } from "./order.repository.js";
import { vendorService } from "../vendor/vendor.service.js";

// 10% for now, later this will come from the vendor plan
const COMMISSION_BPS = 1000; // basis points: 1000 = 10%

type ItemStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

// the steps a vendor is allowed to take
const NEXT_STATUS: Record<ItemStatus, ItemStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// we do the money math in cents (whole numbers) to avoid rounding errors
const toCents = (value: unknown) => Math.round(Number(value) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

export const orderService = {
  createOrder: async (input: {
    customerId: string;
    items: { productId: string; quantity: number }[];
    deliveryAddress: string;
    deliveryCity: string;
    deliveryDepartment: string;
    deliveryNotes?: string;
    paymentMethod: string;
  }) => {
    // for now only cash on delivery is open
    if (input.paymentMethod !== "CASH_ON_DELIVERY") {
      throw new Error("Only cash on delivery is available right now");
    }

    if (input.items.length === 0 || input.items.length > 50) {
      throw new Error("An order needs between 1 and 50 products");
    }

    // merge repeated products into one line
    const wanted = new Map<string, number>();
    for (const item of input.items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
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

      if (!product || product.status !== "ACTIVE") {
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

    const deliveryFeeCents = 0; // delivery pricing comes with the logistics phase
    const orderNumber = `AYX-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    return orderRepository.createWithStock({
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
      items: lines,
    });
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

  // vendor: see the items people bought from my store
  listVendorItems: async (userId: string) => {
    const vendor = await vendorService.getMyStore(userId);
    return orderRepository.listItemsForVendor(vendor.id);
  },

  // vendor: move one item forward (confirm, ship, deliver, or cancel)
  updateItemStatus: async (userId: string, itemId: string, newStatus: ItemStatus) => {
    const vendor = await vendorService.getMyStore(userId);

    const item = await orderRepository.findItemById(itemId);
    if (!item || item.vendorId !== vendor.id) {
      throw new Error("Order item not found");
    }

    const current = item.status as ItemStatus;
    if (!NEXT_STATUS[current]?.includes(newStatus)) {
      throw new Error(`You cannot change an item from ${current} to ${newStatus}`);
    }

    return orderRepository.updateItemStatus(itemId, current, newStatus);
  },
};