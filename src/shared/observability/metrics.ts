import { Request, Response, NextFunction } from "express";
import client from "prom-client";

// numbers about the running app, read by Prometheus (or Grafana Cloud) at GET /metrics
export const registry = new client.Registry();
registry.setDefaultLabels({ service: "aynix-api" });

// memory, CPU, event loop delay, garbage collection…
client.collectDefaultMetrics({ register: registry });

// how long each request takes. from this, dashboards show p50, p95 and p99 latency
const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "How long HTTP requests take",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// business numbers, handy for alerts ("no orders in 2 hours" means something is wrong)
export const ordersPlaced = new client.Counter({
  name: "aynix_orders_placed_total",
  help: "Orders placed",
  registers: [registry],
});
export const deliveriesFinished = new client.Counter({
  name: "aynix_deliveries_finished_total",
  help: "Deliveries finished, by result",
  labelNames: ["status"],
  registers: [registry],
});
export const eventFailures = new client.Counter({
  name: "aynix_event_handler_failures_total",
  help: "Event handlers that failed after every retry (sent to dead letters)",
  labelNames: ["event"],
  registers: [registry],
});

// time every request. we label by route pattern (/api/orders/:id), not the real URL,
// so the number of label values stays small
export const measureRequests = (req: Request, res: Response, next: NextFunction) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : "unmatched";
    end({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
};
