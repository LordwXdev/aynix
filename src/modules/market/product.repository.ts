import { prisma } from "../../shared/database/prisma.js";

type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

export const productRepository = {
  create: async (data: {
    vendorId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    comparePrice?: number;
    stockQty?: number;
    images?: string[];
    status?: ProductStatus;
  }) => {
    return prisma.product.create({ data });
  },

  findById: async (id: string) => {
    return prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, storeName: true, storeSlug: true, whatsapp: true },
        },
      },
    });
  },

  findCategoryById: async (id: string) => {
    return prisma.category.findUnique({ where: { id } });
  },

  // public list: only active products, with optional search and category filter
  listActive: async (filters: {
    q?: string;
    categoryId?: string;
    skip: number;
    take: number;
  }) => {
    const where = {
      status: "ACTIVE" as const,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.q
        ? { name: { contains: filters.q, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  },

  listByVendor: async (vendorId: string) => {
    return prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });
  },

  update: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      comparePrice?: number;
      stockQty?: number;
      images?: string[];
      status?: ProductStatus;
    }
  ) => {
    return prisma.product.update({ where: { id }, data });
  },
};