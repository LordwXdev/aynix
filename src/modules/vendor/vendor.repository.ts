import { prisma } from "../../shared/database/prisma.js";

export const vendorRepository = {
  // find a vendor by the user who owns it
  findByUserId: async (userId: string) => {
    return prisma.vendor.findUnique({ where: { userId } });
  },

  // find a vendor by their store slug
  findBySlug: async (storeSlug: string) => {
    return prisma.vendor.findUnique({ where: { storeSlug } });
  },

  // create a new vendor store
  create: async (data: {
    userId: string;
    storeName: string;
    storeSlug: string;
    description?: string;
    whatsapp?: string;
  }) => {
    return prisma.vendor.create({ data });
  },
};
