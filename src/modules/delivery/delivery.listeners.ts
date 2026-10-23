import { eventBus } from "../../shared/events/event-bus.js";
import { deliveryService } from "./delivery.service.js";

export const registerDeliveryListeners = () => {
  const on = eventBus.subscriber("delivery");

  on("order.status_changed", async ({ orderId, status }) => {
    // every store confirmed: time to send a driver
    if (status === "CONFIRMED") {
      await deliveryService.createForOrder(orderId);
    }
    if (status === "CANCELLED") {
      await deliveryService.cancelForOrder(orderId);
    }
  });

  // a driver just came online, maybe there is work waiting
  on("driver.online", async () => {
    await deliveryService.assignWaiting();
  });
  // jobs nobody took yet are retried by the scheduled jobs (modules/jobs)
};
