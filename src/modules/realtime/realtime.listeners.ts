import { eventBus } from "../../shared/events/event-bus.js";
import { realtimeHub } from "../../shared/realtime/hub.js";

// turns system events into live messages for the apps
export const registerRealtimeListeners = () => {
  const on = eventBus.subscriber("realtime");

  on("order.placed", (event) => {
    realtimeHub.toAdmins("admin:order", { ...event, status: "PENDING" });
  });

  on("order.status_changed", (event) => {
    realtimeHub.toOrder(event.orderId, "order:update", event);
    realtimeHub.toUser(event.customerId, "order:update", event);
    realtimeHub.toAdmins("admin:order", event);
  });

  on("order.item_status_changed", (event) => {
    realtimeHub.toOrder(event.orderId, "order:item_update", event);
  });

  on("delivery.status_changed", (event) => {
    realtimeHub.toOrder(event.orderId, "delivery:update", event);
    if (event.driverUserId) {
      realtimeHub.toUser(event.driverUserId, "delivery:update", event);
    }
  });

  // the customer's map moves as the driver moves
  on("driver.location_updated", ({ driverId, lat, lng, activeOrderIds }) => {
    for (const orderId of activeOrderIds) {
      realtimeHub.toOrder(orderId, "delivery:location", { orderId, lat, lng });
    }
    realtimeHub.toAdmins("admin:driver_location", { driverId, lat, lng });
  });
};
