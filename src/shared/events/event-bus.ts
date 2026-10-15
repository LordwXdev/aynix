import { EventEmitter } from "node:events";
import { prisma } from "../database/prisma.js";
import { logger } from "../logger.js";
import { retry } from "../utils/resilience.js";
import { eventFailures } from "../observability/metrics.js";

// every event in the system and the data it carries
// when we move to Kafka or RabbitMQ later, these become the message types
export interface AppEvents {
  "order.placed": {
    orderId: string;
    orderNumber: string;
    customerId: string;
    vendorIds: string[];
  };
  "order.status_changed": {
    orderId: string;
    orderNumber: string;
    customerId: string;
    status: string;
  };
  "order.item_status_changed": {
    orderId: string;
    itemId: string;
    vendorId: string;
    status: string;
  };
  "delivery.assigned": {
    deliveryId: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    driverUserId: string;
  };
  "delivery.status_changed": {
    deliveryId: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    driverUserId: string | null;
    status: string;
  };
  "vendor.status_changed": { vendorId: string; userId: string; status: string };
  "driver.status_changed": { driverId: string; userId: string; status: string };
  "driver.online": { driverId: string };
  "driver.location_updated": {
    driverId: string;
    lat: number;
    lng: number;
    activeOrderIds: string[];
  };
}

export type EventName = keyof AppEvents;
type Handler<K extends EventName> = (payload: AppEvents[K]) => void | Promise<void>;

// a small in-process event bus
// the module that emits does not know or care who is listening
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// every listener by name, so a failed event can be replayed later
const listeners = new Map<string, (payload: unknown) => Promise<void>>();

const ATTEMPTS = 3;

// run a listener with retries; if it still fails, park the event in the dead letter table
const deliver = async (event: string, label: string, handler: (p: unknown) => void | Promise<void>, payload: unknown) => {
  try {
    await retry(async () => handler(payload), { attempts: ATTEMPTS, baseMs: 300, maxMs: 5_000 });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ event, handler: label, err }, "event handler failed, sent to dead letters");
    eventFailures.inc({ event });
    await prisma.deadLetter
      .create({
        data: { event, handler: label, payload: payload as object, error, attempts: ATTEMPTS },
      })
      .catch((dbErr) => logger.error({ event, handler: label, err: dbErr }, "could not save dead letter"));
  }
};

export const eventBus = {
  emit<K extends EventName>(name: K, payload: AppEvents[K]) {
    emitter.emit(name, payload);
  },

  // each module subscribes under its own name, e.g. "notification" or "delivery"
  subscriber(module: string) {
    let count = 0;
    return <K extends EventName>(name: K, handler: Handler<K>) => {
      const label = `${module}:${name}#${++count}`;
      const run = handler as (p: unknown) => void | Promise<void>;
      listeners.set(label, async (p) => run(p));
      emitter.on(name, (payload: AppEvents[K]) => {
        // one broken listener must never crash the request that emitted
        void deliver(name, label, run, payload);
      });
    };
  },

  // try a dead letter again (used by the admin panel)
  async replay(handlerLabel: string, payload: unknown) {
    const handler = listeners.get(handlerLabel);
    if (!handler) throw new Error(`No listener called ${handlerLabel}`);
    await handler(payload);
  },

  // let other parts register something that can be replayed (like sending an SMS)
  registerReplayable(label: string, handler: (payload: unknown) => Promise<void>) {
    listeners.set(label, handler);
  },
};
