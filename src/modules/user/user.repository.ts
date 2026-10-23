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

  // change what a user can update about themselves
  updateProfile: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      address?: string;
      city?: string;
      department?: string;
    }
  ) => {
    return prisma.user.update({ where: { id }, data });
  },

  // --- refresh tokens ---

  saveRefreshToken: async (data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) => {
    return prisma.refreshToken.create({ data });
  },

  findRefreshToken: async (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  },

  // mark a token as used, only if nobody used it first
  revokeRefreshToken: async (id: string) => {
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  },

  // log the user out everywhere
  revokeAllRefreshTokens: async (userId: string) => {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
