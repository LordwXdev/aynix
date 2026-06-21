import { prisma } from "../../shared/database/prisma.js";

export const userRepository = {
  // find one user by their phone number
  findByPhone: async (phone: string) => {
    return prisma.user.findUnique({ where: { phone } });
  },

  // find one user by their id
  findById: async (id: string) => {
    return prisma.user.findUnique({ where: { id } });
  },

  // create a new user
  create: async (data: {
    name: string;
    phone: string;
    passwordHash: string;
    email?: string;
  }) => {
    return prisma.user.create({ data });
  },
};
