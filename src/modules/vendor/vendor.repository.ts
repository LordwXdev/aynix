import { prisma } from "../../shared/database/prisma.js";

type VendorStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface StoreDetails {
  description?: string;
  whatsapp?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  department?: string;
  latitude?: number;
  longitude?: number;
}

export const vendorRepository = {
  // find a vendor by the user who owns it
  findByUserId: async (userId: string) => {
    return prisma.vendor.findUnique({ where: { userId } });
  },

  findById: async (id: string) => {
    return prisma.vendor.findUnique({ where: { id } });
  },

  // find a vendor by their store slug
  findBySlug: async (storeSlug: string) => {
    return prisma.vendor.findUnique({ where: { storeSlug } });
  },

  // public store page: the store and its active products
  findPublicBySlug: async (storeSlug: string) => {
    return prisma.vendor.findFirst({
      where: { storeSlug, status: "ACTIVE" },
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        description: true,
        logoUrl: true,
        whatsapp: true,
        city: true,
        department: true,
        createdAt: true,
        products: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },

  // create the store and turn the customer into a vendor, both or nothing
  create: async (data: StoreDetails & {
    userId: string;
    storeName: string;
    storeSlug: string;
  }) => {
    return prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({ data });
      await tx.user.updateMany({
        where: { id: data.userId, role: "CUSTOMER" },
        data: { role: "VENDOR" },
      });
      return vendor;
    });
  },

  update: async (id: string, data: StoreDetails & { storeName?: string }) => {
    return prisma.vendor.update({ where: { id }, data });
  },

  setStatus: async (id: string, status: VendorStatus) => {
    return prisma.vendor.update({ where: { id }, data: { status } });
  },

  list: async (filters: { status?: VendorStatus; skip: number; take: number }) => {
    const where = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
        include: {
          user: { select: { name: true, phone: true, isActive: true } },
          _count: { select: { products: true } },
        },
      }),
      prisma.vendor.count({ where }),
    ]);
    return { items, total };
  },
};
