import { eventBus } from "../../shared/events/event-bus.js";
import { deliveryService } from "./delivery.service.js";

// how often we look again for drivers for jobs nobody took yet
const RETRY_EVERY_MS = 60 * 1000;

export const registerDeliveryListeners = () => {
  eventBus.on("order.status_changed", async ({ orderId, status }) => {
    // every store confirmed: time to send a driver
    if (status === "CONFIRMED") {
      await deliveryService.createForOrder(orderId);
    }
    if (status === "CANCELLED") {
      await deliveryService.cancelForOrder(orderId);
    }
  });

  // a driver just came online, maybe there is work waiting
  eventBus.on("driver.online", async () => {
    await deliveryService.assignWaiting();
  });

  const timer = setInterval(() => {
    deliveryService
      .assignWaiting()
      .catch((err) => console.error("[delivery] retry failed:", err));
  }, RETRY_EVERY_MS);
  timer.unref();
};
