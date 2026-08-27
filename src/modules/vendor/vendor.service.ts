import { vendorRepository } from "./vendor.repository.js";

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

export const vendorService = {
  // create a store for a logged-in user
  createStore: async (input: {
    userId: string;
    storeName: string;
    description?: string;
    whatsapp?: string;
  }) => {
    // check if this user already owns a store
    const existing = await vendorRepository.findByUserId(input.userId);
    if (existing) {
      throw new Error("You already have a store");
    }

    // build a slug from the store name
    let slug = makeSlug(input.storeName);

    // make sure the slug is not already taken
    const slugTaken = await vendorRepository.findBySlug(slug);
    if (slugTaken) {
      // add a short random suffix to make it unique
      slug = slug + "-" + Math.random().toString(36).substring(2, 6);
    }

    // create the store
    const vendor = await vendorRepository.create({
      userId: input.userId,
      storeName: input.storeName,
      storeSlug: slug,
      description: input.description,
      whatsapp: input.whatsapp,
    });

    return vendor;
  },

  // get a store by the user who owns it
  getMyStore: async (userId: string) => {
    const vendor = await vendorRepository.findByUserId(userId);
    if (!vendor) {
      throw new Error("You do not have a store yet");
    }
    return vendor;
  },
};
