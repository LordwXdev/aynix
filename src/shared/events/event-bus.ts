import { EventEmitter } from "node:events";

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

type EventName = keyof AppEvents;
type Handler<K extends EventName> = (payload: AppEvents[K]) => void | Promise<void>;

// a small in-process event bus
// the module that emits does not know or care who is listening
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export const eventBus = {
  emit<K extends EventName>(name: K, payload: AppEvents[K]) {
    emitter.emit(name, payload);
  },

  on<K extends EventName>(name: K, handler: Handler<K>) {
    emitter.on(name, (payload: AppEvents[K]) => {
      // one broken listener must never crash the request that emitted
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => console.error(`[event ${name}] handler failed:`, err));
    });
  },
};
