import { prisma } from "../../shared/database/prisma.js";

export const categoryRepository = {
  listActive: async () => {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  listAll: async () => {
    return prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
  },

  findById: async (id: string) => {
    return prisma.category.findUnique({ where: { id } });
  },

  findBySlug: async (slug: string) => {
    return prisma.category.findUnique({ where: { slug } });
  },

  create: async (data: { name: string; slug: string; parentId?: string; sortOrder?: number }) => {
    return prisma.category.create({ data });
  },

  update: async (
    id: string,
    data: { name?: string; parentId?: string | null; sortOrder?: number; isActive?: boolean }
  ) => {
    return prisma.category.update({ where: { id }, data });
  },
};
