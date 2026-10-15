import { deliveryRepository, DeliveryStatus } from "./delivery.repository.js";
import { driverRepository } from "./driver.repository.js";
import { driverService } from "./driver.service.js";
import { orderRepository } from "../order/order.repository.js";
import { announceOrderChange } from "../order/order.service.js";
import { prisma } from "../../shared/database/prisma.js";
import { eventBus } from "../../shared/events/event-bus.js";
import { distanceKm } from "../../shared/utils/geo.js";

// a driver who has not sent their position for this long is treated as gone
const DRIVER_FRESH_MINUTES = 30;

const DELIVERY_STATUS: DeliveryStatus[] = [
  "WAITING_FOR_DRIVER",
  "ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

// run driver assignment one at a time so two jobs never grab the same driver
// (fine for one server; with many servers this becomes a database lock)
let assignQueue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(work: () => Promise<T>): Promise<T> => {
  const run = assignQueue.then(work);
  assignQueue = run.catch(() => undefined);
  return run;
};

type Delivery = NonNullable<Awaited<ReturnType<typeof deliveryRepository.findById>>>;

const announceDelivery = (delivery: Delivery, status: DeliveryStatus, driverUserId: string | null) => {
  eventBus.emit("delivery.status_changed", {
    deliveryId: delivery.id,
    orderId: delivery.order.id,
    orderNumber: delivery.order.orderNumber,
    customerId: delivery.order.customerId,
    driverUserId,
    status,
  });
};

// where the driver goes first: the first store that has a location,
// or the customer if no store has one
const pickupPoint = (delivery: Delivery) => {
  const store = delivery.order.items
    .map((i) => i.vendor)
    .find((v) => v.latitude !== null && v.longitude !== null);
  if (store) return { lat: store.latitude!, lng: store.longitude! };

  const { deliveryLatitude: lat, deliveryLongitude: lng } = delivery.order;
  if (lat !== null && lng !== null) return { lat, lng };
  return null;
};

// the actual matching: pick the closest free driver in the same department
// drivers with no GPS position go to the back, most recently active first
const chooseDriver = async (delivery: Delivery) => {
  const candidates = await driverRepository.findAvailable({
    department: delivery.order.deliveryDepartment,
    seenSince: new Date(Date.now() - DRIVER_FRESH_MINUTES * 60 * 1000),
    excludeIds: delivery.declinedDriverIds,
  });
  if (candidates.length === 0) return null;

  const target = pickupPoint(delivery);
  const scored = candidates.map((driver) => ({
    driver,
    km:
      target && driver.latitude !== null && driver.longitude !== null
        ? distanceKm(target, { lat: driver.latitude, lng: driver.longitude })
        : Number.POSITIVE_INFINITY,
  }));

  scored.sort(
    (a, b) =>
      a.km - b.km ||
      (b.driver.lastSeenAt?.getTime() ?? 0) - (a.driver.lastSeenAt?.getTime() ?? 0)
  );
  return scored[0].driver;
};

const getDeliveryOrThrow = async (id: string) => {
  const delivery = await deliveryRepository.findById(id);
  if (!delivery) {
    throw new Error("Delivery not found");
  }
  return delivery;
};

export const deliveryService = {
  // called when every store has confirmed the order
  createForOrder: async (orderId: string) => {
    const delivery = await deliveryRepository.createForOrder(orderId);
    await deliveryService.autoAssign(delivery.id);
    return delivery;
  },

  // try to give a waiting delivery to the best free driver
  // returns the driver id, or null if nobody is free right now
  autoAssign: (deliveryId: string) =>
    oneAtATime(async () => {
      const delivery = await deliveryRepository.findById(deliveryId);
      if (!delivery || delivery.status !== "WAITING_FOR_DRIVER") return null;

      const driver = await chooseDriver(delivery);
      if (!driver) return null;

      const assigned = await prisma.$transaction(async (tx) => {
        if (await deliveryRepository.driverIsBusy(tx, driver.id)) return false;
        return deliveryRepository.transition(tx, deliveryId, ["WAITING_FOR_DRIVER"], {
          status: "ASSIGNED",
          driverId: driver.id,
          assignedAt: new Date(),
        });
      });
      if (!assigned) return null;

      eventBus.emit("delivery.assigned", {
        deliveryId,
        orderId: delivery.order.id,
        orderNumber: delivery.order.orderNumber,
        customerId: delivery.order.customerId,
        driverUserId: driver.userId,
      });
      announceDelivery(delivery, "ASSIGNED", driver.userId);
      return driver.id;
    }),

  // go through every waiting delivery and try to find drivers
  assignWaiting: async () => {
    const ids = await deliveryRepository.findWaitingIds();
    for (const id of ids) {
      await deliveryService.autoAssign(id);
    }
  },

  // the order was cancelled before pickup, so the job is off
  cancelForOrder: async (orderId: string) => {
    const existing = await deliveryRepository.findByOrderId(orderId);
    if (!existing) return;

    const cancelled = await deliveryRepository.transition(
      prisma,
      existing.id,
      ["WAITING_FOR_DRIVER", "ASSIGNED"],
      { status: "CANCELLED" }
    );
    if (!cancelled) return;

    const delivery = await getDeliveryOrThrow(existing.id);
    announceDelivery(delivery, "CANCELLED", existing.driver?.userId ?? null);

    // the driver is free again
    if (existing.driver) {
      void deliveryService.assignWaiting();
    }
  },

  // --- driver actions ---

  listMine: async (userId: string, activeOnly: boolean) => {
    const driver = await driverService.getMine(userId);
    return deliveryRepository.listForDriver(
      driver.id,
      activeOnly ? ["ASSIGNED", "PICKED_UP"] : undefined
    );
  },

  // driver says no: put the job back and find someone else
  decline: async (userId: string, deliveryId: string) => {
    const driver = await driverService.getMine(userId);
    const ok = await deliveryRepository.transition(
      prisma,
      deliveryId,
      ["ASSIGNED"],
      {
        status: "WAITING_FOR_DRIVER",
        driverId: null,
        assignedAt: null,
        declinedDriverIds: { push: driver.id },
      },
      driver.id
    );
    if (!ok) {
      throw new Error("You can only decline a job that is assigned to you");
    }

    const delivery = await getDeliveryOrThrow(deliveryId);
    announceDelivery(delivery, "WAITING_FOR_DRIVER", null);
    await deliveryService.autoAssign(deliveryId);
    return getDeliveryOrThrow(deliveryId);
  },

  // driver has collected the goods from the store(s)
  pickUp: async (userId: string, deliveryId: string) => {
    const driver = await driverService.getMine(userId);

    const sync = await prisma.$transaction(async (tx) => {
      const ok = await deliveryRepository.transition(
        tx,
        deliveryId,
        ["ASSIGNED"],
        { status: "PICKED_UP", pickedUpAt: new Date() },
        driver.id
      );
      if (!ok) {
        throw new Error("This job is not assigned to you or was already picked up");
      }
      const delivery = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      return orderRepository.moveItems(tx, delivery.orderId, ["CONFIRMED"], "SHIPPED");
    });

    const delivery = await getDeliveryOrThrow(deliveryId);
    announceOrderChange(sync);
    announceDelivery(delivery, "PICKED_UP", userId);
    return delivery;
  },

  // driver handed the order to the customer (and collected the cash)
  deliver: async (userId: string, deliveryId: string) => {
    const driver = await driverService.getMine(userId);

    const sync = await prisma.$transaction(async (tx) => {
      const ok = await deliveryRepository.transition(
        tx,
        deliveryId,
        ["PICKED_UP"],
        { status: "DELIVERED", deliveredAt: new Date() },
        driver.id
      );
      if (!ok) {
        throw new Error("Pick up the order before marking it delivered");
      }
      const delivery = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      return orderRepository.moveItems(tx, delivery.orderId, ["SHIPPED"], "DELIVERED");
    });

    const delivery = await getDeliveryOrThrow(deliveryId);
    announceOrderChange(sync);
    announceDelivery(delivery, "DELIVERED", userId);

    // this driver is free for the next job
    void deliveryService.assignWaiting();
    return delivery;
  },

  // driver could not hand it over (customer not there, wrong address...)
  fail: async (userId: string, deliveryId: string, reason: string) => {
    const driver = await driverService.getMine(userId);
    const ok = await deliveryRepository.transition(
      prisma,
      deliveryId,
      ["PICKED_UP"],
      { status: "FAILED", failReason: reason },
      driver.id
    );
    if (!ok) {
      throw new Error("Only a picked up job can be marked as failed");
    }

    const delivery = await getDeliveryOrThrow(deliveryId);
    announceDelivery(delivery, "FAILED", userId);
    void deliveryService.assignWaiting();
    return delivery;
  },

  // --- admin ---

  list: async (input: { status?: string; page: number; limit: number }) => {
    if (input.status && !DELIVERY_STATUS.includes(input.status as DeliveryStatus)) {
      throw new Error("Invalid status");
    }
    const page = Math.max(1, input.page);
    const limit = Math.min(100, Math.max(1, input.limit));
    const result = await deliveryRepository.list({
      status: input.status as DeliveryStatus | undefined,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { ...result, page, limit };
  },

  // admin picks a driver by hand
  // also works to reassign a job, or to retry a failed delivery with someone new
  adminAssign: async (deliveryId: string, driverId: string) => {
    const driver = await driverRepository.findById(driverId);
    if (!driver || driver.status !== "ACTIVE") {
      throw new Error("Driver not found or not active");
    }

    const before = await getDeliveryOrThrow(deliveryId);
    const previousDriverUserId = before.driver?.userId ?? null;

    await oneAtATime(() =>
      prisma.$transaction(async (tx) => {
        if (await deliveryRepository.driverIsBusy(tx, driverId, deliveryId)) {
          throw new Error("This driver is already on another job");
        }
        const ok = await deliveryRepository.transition(
          tx,
          deliveryId,
          ["WAITING_FOR_DRIVER", "ASSIGNED", "FAILED"],
          {
            status: "ASSIGNED",
            driverId,
            assignedAt: new Date(),
            pickedUpAt: null,
            failReason: null,
          }
        );
        if (!ok) {
          throw new Error("This delivery cannot be reassigned now");
        }
      })
    );

    const delivery = await getDeliveryOrThrow(deliveryId);
    eventBus.emit("delivery.assigned", {
      deliveryId,
      orderId: delivery.order.id,
      orderNumber: delivery.order.orderNumber,
      customerId: delivery.order.customerId,
      driverUserId: driver.userId,
    });
    announceDelivery(delivery, "ASSIGNED", driver.userId);

    // the old driver is free again
    if (previousDriverUserId && previousDriverUserId !== driver.userId) {
      void deliveryService.assignWaiting();
    }
    return delivery;
  },
};
