import { eventBus } from "../events/event-bus.js";
import { deliveriesFinished, ordersPlaced } from "./metrics.js";

// count what matters to the business, from the same events everything else uses
export const registerBusinessMetrics = () => {
  const on = eventBus.subscriber("metrics");
  on("order.placed", () => {
    ordersPlaced.inc();
  });
  on("delivery.status_changed", ({ status }) => {
    if (status === "DELIVERED" || status === "FAILED") deliveriesFinished.inc({ status });
  });
};
