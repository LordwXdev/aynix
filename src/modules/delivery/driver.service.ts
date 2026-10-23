import { driverRepository, DriverStatus, VehicleType } from "./driver.repository.js";
import { userRepository } from "../user/user.repository.js";
import { eventBus } from "../../shared/events/event-bus.js";
import { isValidLatLng } from "../../shared/utils/geo.js";

const VEHICLES = ["MOTO", "CAR", "BICYCLE", "FOOT"] as const;
const DRIVER_STATUS = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;

export const driverService = {
  // a customer applies to drive for Aynix Move
  apply: async (input: {
    userId: string;
    vehicleType: string;
    plateNumber?: string;
    city: string;
    department: string;
  }) => {
    if (!VEHICLES.includes(input.vehicleType as VehicleType)) {
      throw new Error("vehicleType must be MOTO, CAR, BICYCLE, or FOOT");
    }

    const user = await userRepository.findById(input.userId);
    if (!user) {
      throw new Error("User not found");
    }
    // one account, one job
    if (user.role !== "CUSTOMER") {
      throw new Error("Only customer accounts can apply to drive");
    }
    if (await driverRepository.findByUserId(input.userId)) {
      throw new Error("You already applied");
    }

    return driverRepository.create({
      userId: input.userId,
      vehicleType: input.vehicleType as VehicleType,
      plateNumber: input.plateNumber,
      city: input.city,
      department: input.department,
    });
  },

  getMine: async (userId: string) => {
    const driver = await driverRepository.findByUserId(userId);
    if (!driver) {
      throw new Error("You are not a driver");
    }
    return driver;
  },

  // driver taps "go online" / "go offline" in the app
  setOnline: async (userId: string, isOnline: boolean) => {
    const driver = await driverService.getMine(userId);
    if (isOnline && driver.status !== "ACTIVE") {
      throw new Error("Your driver account is not approved yet");
    }

    const updated = await driverRepository.update(driver.id, {
      isOnline,
      lastSeenAt: new Date(),
    });

    if (isOnline) {
      eventBus.emit("driver.online", { driverId: driver.id });
    }
    return updated;
  },

  // the app sends the phone's GPS position every few seconds
  updateLocation: async (userId: string, lat: number, lng: number) => {
    if (!isValidLatLng(lat, lng)) {
      throw new Error("Invalid latitude or longitude");
    }
    const driver = await driverService.getMine(userId);

    await driverRepository.update(driver.id, {
      latitude: lat,
      longitude: lng,
      lastSeenAt: new Date(),
    });

    const activeOrderIds = await driverRepository.activeOrderIds(driver.id);
    eventBus.emit("driver.location_updated", {
      driverId: driver.id,
      lat,
      lng,
      activeOrderIds,
    });

    return { ok: true };
  },

  // --- admin ---

  list: async (input: { status?: string; online?: boolean; page: number; limit: number }) => {
    if (input.status && !DRIVER_STATUS.includes(input.status as DriverStatus)) {
      throw new Error("Invalid status");
    }
    const page = Math.max(1, input.page);
    const limit = Math.min(100, Math.max(1, input.limit));
    const result = await driverRepository.list({
      status: input.status as DriverStatus | undefined,
      online: input.online,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { ...result, page, limit };
  },

  setStatus: async (driverId: string, status: string) => {
    if (!DRIVER_STATUS.includes(status as DriverStatus)) {
      throw new Error("status must be PENDING, ACTIVE, SUSPENDED, or REJECTED");
    }
    const driver = await driverRepository.findById(driverId);
    if (!driver) {
      throw new Error("Driver not found");
    }

    const updated = await driverRepository.update(driverId, {
      status: status as DriverStatus,
      // a driver who is not active cannot stay online
      ...(status !== "ACTIVE" ? { isOnline: false } : {}),
    });

    eventBus.emit("driver.status_changed", { driverId, userId: driver.userId, status });
    return updated;
  },

  goOffline: async (userId: string) => {
    const driver = await driverRepository.findByUserId(userId);
    if (driver?.isOnline) {
      await driverRepository.update(driver.id, { isOnline: false });
    }
  },
};
