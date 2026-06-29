import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { userRepository } from "./user.repository.js";

export const userService = {
  register: async (input: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => {
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

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not set in environment");
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: "7d" }
    );

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  },
};
