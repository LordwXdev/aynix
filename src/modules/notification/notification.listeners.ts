import { eventBus } from "../../shared/events/event-bus.js";
import { notificationService } from "./notification.service.js";
import { vendorService } from "../vendor/vendor.service.js";
import { realtimeHub } from "../../shared/realtime/hub.js";

const ORDER_MESSAGES: Record<string, string> = {
  CONFIRMED: "has been confirmed by the store and is waiting for a driver",
  SHIPPED: "is on the way",
  DELIVERED: "has been delivered. Thank you for shopping with Aynix",
  CANCELLED: "has been cancelled",
};

// listens to what happens in the system and tells the right people
export const registerNotificationListeners = () => {
  eventBus.on("order.placed", async ({ orderId, orderNumber, customerId, vendorIds }) => {
    await notificationService.send(customerId, {
      type: "order.placed",
      title: "Order received",
      body: `Your order ${orderNumber} was received.`,
      data: { orderId },
    });

    for (const vendorId of vendorIds) {
      const vendor = await vendorService.getStoreById(vendorId);
      if (!vendor) continue;
      await notificationService.send(vendor.userId, {
        type: "vendor.new_order",
        title: "New order",
        body: `You have a new order (${orderNumber}). Please confirm it.`,
        data: { orderId },
        sms: true,
      });
    }
  });

  eventBus.on("order.status_changed", async ({ orderId, orderNumber, customerId, status }) => {
    const message = ORDER_MESSAGES[status];
    if (!message) return;
    await notificationService.send(customerId, {
      type: "order.status",
      title: "Order update",
      body: `Your order ${orderNumber} ${message}.`,
      data: { orderId, status },
      sms: status === "DELIVERED" || status === "CANCELLED",
    });
  });

  eventBus.on("delivery.assigned", async ({ deliveryId, orderId, orderNumber, customerId, driverUserId }) => {
    await notificationService.send(driverUserId, {
      type: "driver.new_job",
      title: "New delivery job",
      body: `You have a new delivery: order ${orderNumber}.`,
      data: { deliveryId, orderId },
      sms: true,
    });
    await notificationService.send(customerId, {
      type: "order.driver_assigned",
      title: "Driver on the way",
      body: `A driver has been assigned to your order ${orderNumber}.`,
      data: { orderId },
    });
  });

  eventBus.on("delivery.status_changed", async (event) => {
    // the control center sees every delivery change live
    realtimeHub.toAdmins("admin:delivery", event);

    if (event.status === "FAILED") {
      await notificationService.send(event.customerId, {
        type: "order.delivery_failed",
        title: "Delivery problem",
        body: `We could not deliver order ${event.orderNumber}. Our team will contact you.`,
        data: { orderId: event.orderId },
        sms: true,
      });
    }
    if (event.status === "CANCELLED" && event.driverUserId) {
      await notificationService.send(event.driverUserId, {
        type: "driver.job_cancelled",
        title: "Job cancelled",
        body: `Order ${event.orderNumber} was cancelled. You do not need to pick it up.`,
        data: { orderId: event.orderId },
      });
    }
  });

  eventBus.on("vendor.status_changed", async ({ userId, status }) => {
    const text: Record<string, string> = {
      ACTIVE: "Your store has been approved. You can start selling!",
      SUSPENDED: "Your store has been suspended. Contact Aynix support.",
      REJECTED: "Your store application was not approved.",
    };
    if (!text[status]) return;
    await notificationService.send(userId, {
      type: "vendor.status",
      title: "Store update",
      body: text[status],
      data: { status },
      sms: true,
    });
  });

  eventBus.on("driver.status_changed", async ({ userId, status }) => {
    const text: Record<string, string> = {
      ACTIVE: "You are approved to drive with Aynix Move. Go online to get jobs!",
      SUSPENDED: "Your driver account has been suspended. Contact Aynix support.",
      REJECTED: "Your driver application was not approved.",
    };
    if (!text[status]) return;
    await notificationService.send(userId, {
      type: "driver.status",
      title: "Driver account update",
      body: text[status],
      data: { status },
      sms: true,
    });
  });
};
