import { vendorRepository, StoreDetails } from "./vendor.repository.js";
import { userRepository } from "../user/user.repository.js";
import { eventBus } from "../../shared/events/event-bus.js";
import { isValidLatLng } from "../../shared/utils/geo.js";
import { isSafeImageUrl } from "../../shared/utils/validate.js";

const VENDOR_STATUS = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
type VendorStatus = (typeof VENDOR_STATUS)[number];

// turn a store name into a web-friendly slug
// "Ti Jan Shop" becomes "ti-jan-shop"
const makeSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove anything that is not a letter, number, space, or dash
    .replace(/\s+/g, "-")            // turn spaces into dashes
    .replace(/-+/g, "-");            // collapse multiple dashes into one
};

// latitude and longitude must come together and be real coordinates
// (and a logo must be a normal web link)
const checkLocation = (details: StoreDetails) => {
  if (details.logoUrl !== undefined && !isSafeImageUrl(details.logoUrl)) {
    throw new Error("logoUrl must be a web link (http or https)");
  }
  const hasLat = details.latitude !== undefined;
  const hasLng = details.longitude !== undefined;
  if (hasLat !== hasLng) {
    throw new Error("Send both latitude and longitude, or neither");
  }
  if (hasLat && !isValidLatLng(details.latitude, details.longitude)) {
    throw new Error("Invalid latitude or longitude");
  }
};

export const vendorService = {
  // create a store for a logged-in user
  createStore: async (input: StoreDetails & {
    userId: string;
    storeName: string;
  }) => {
    const user = await userRepository.findById(input.userId);
    if (!user) {
      throw new Error("User not found");
    }
    // one account, one job: a driver account cannot also run a store
    if (user.role === "DRIVER") {
      throw new Error("Driver accounts cannot open a store");
    }

    // check if this user already owns a store
    const existing = await vendorRepository.findByUserId(input.userId);
    if (existing) {
      throw new Error("You already have a store");
    }

    checkLocation(input);

    // build a slug from the store name
    let slug = makeSlug(input.storeName);
    if (!slug) {
      slug = "store";
    }

    // make sure the slug is not already taken
    const slugTaken = await vendorRepository.findBySlug(slug);
    if (slugTaken) {
      // add a short random suffix to make it unique
      slug = slug + "-" + Math.random().toString(36).substring(2, 6);
    }

    // create the store (this also makes the user a VENDOR)
    return vendorRepository.create({ ...input, storeSlug: slug });
  },

  // get a store by the user who owns it
  getMyStore: async (userId: string) => {
    const vendor = await vendorRepository.findByUserId(userId);
    if (!vendor) {
      throw new Error("You do not have a store yet");
    }
    return vendor;
  },

  updateMyStore: async (
    userId: string,
    input: StoreDetails & { storeName?: string }
  ) => {
    const vendor = await vendorService.getMyStore(userId);
    checkLocation(input);
    // the slug stays the same so old links keep working
    return vendorRepository.update(vendor.id, input);
  },

  getStoreById: async (vendorId: string) => {
    return vendorRepository.findById(vendorId);
  },

  // public store page, only for approved stores
  getPublicStore: async (slug: string) => {
    const store = await vendorRepository.findPublicBySlug(slug);
    if (!store) {
      throw new Error("Store not found");
    }
    return store;
  },

  // --- admin ---

  listStores: async (input: { status?: string; page: number; limit: number }) => {
    if (input.status && !VENDOR_STATUS.includes(input.status as VendorStatus)) {
      throw new Error("Invalid status");
    }
    const page = Math.max(1, input.page);
    const limit = Math.min(100, Math.max(1, input.limit));
    const result = await vendorRepository.list({
      status: input.status as VendorStatus | undefined,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { ...result, page, limit };
  },

  setStatus: async (vendorId: string, status: string) => {
    if (!VENDOR_STATUS.includes(status as VendorStatus)) {
      throw new Error("status must be PENDING, ACTIVE, SUSPENDED, or REJECTED");
    }
    const vendor = await vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new Error("Store not found");
    }
    const updated = await vendorRepository.setStatus(vendorId, status as VendorStatus);
    eventBus.emit("vendor.status_changed", {
      vendorId,
      userId: vendor.userId,
      status,
    });
    return updated;
  },
};
