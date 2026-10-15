import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { userRepository } from "./user.repository.js";
import { env } from "../../config/env.js";

type SafeUser = Omit<
  NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>,
  "passwordHash"
>;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const toSafeUser = (user: { passwordHash: string } & SafeUser): SafeUser => {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
};

// give the user a short access token and a long refresh token
// the refresh token is random, we only store its hash
const issueTokens = async (user: { id: string; role: string }) => {
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.accessTokenTtl as SignOptions["expiresIn"],
  });

  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await userRepository.saveRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
};

export const userService = {
  register: async (input: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => {
    if (input.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const existing = await userRepository.findByPhone(input.phone);
    if (existing) {
      throw new Error("Phone number already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await userRepository.create({
      name: input.name,
      phone: input.phone,
      passwordHash,
      email: input.email,
    });

    const tokens = await issueTokens(user);
    return { user: toSafeUser(user), ...tokens };
  },

  login: async (input: { phone: string; password: string }) => {
    const user = await userRepository.findByPhone(input.phone);
    if (!user) {
      throw new Error("Invalid phone or password");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid phone or password");
    }

    // checked after the password so we don't reveal which accounts exist
    if (!user.isActive) {
      throw new Error("This account has been disabled");
    }

    const tokens = await issueTokens(user);
    return { user: toSafeUser(user), ...tokens };
  },

  // swap a refresh token for a new pair (the old one stops working)
  refresh: async (refreshToken: string) => {
    const stored = await userRepository.findRefreshToken(hashToken(refreshToken));
    if (!stored) {
      throw new Error("Invalid refresh token");
    }

    // a token that was already used is coming back: someone may have stolen it,
    // so we log this user out of every device to be safe
    if (stored.revokedAt) {
      await userRepository.revokeAllRefreshTokens(stored.userId);
      throw new Error("Invalid refresh token");
    }

    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new Error("Invalid refresh token");
    }

    const claimed = await userRepository.revokeRefreshToken(stored.id);
    if (!claimed) {
      throw new Error("Invalid refresh token");
    }

    // the new access token carries the user's current role
    // so a customer who just opened a store becomes a vendor here
    return issueTokens(stored.user);
  },

  logout: async (refreshToken: string) => {
    const stored = await userRepository.findRefreshToken(hashToken(refreshToken));
    if (stored) {
      await userRepository.revokeRefreshToken(stored.id);
    }
  },

  logoutEverywhere: async (userId: string) => {
    await userRepository.revokeAllRefreshTokens(userId);
  },

  // get a user's own profile by their id
  getProfile: async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return toSafeUser(user);
  },

  updateProfile: async (
    userId: string,
    input: {
      name?: string;
      email?: string;
      address?: string;
      city?: string;
      department?: string;
    }
  ) => {
    const user = await userRepository.updateProfile(userId, input);
    return toSafeUser(user);
  },
};
