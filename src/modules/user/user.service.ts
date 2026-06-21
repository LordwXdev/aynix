import bcrypt from "bcrypt";
import { userRepository } from "./user.repository.js";

export const userService = {
  // register a new user
  register: async (input: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => {
    // check if someone already uses this phone
    const existing = await userRepository.findByPhone(input.phone);
    if (existing) {
      throw new Error("Phone number already registered");
    }

    // scramble the password before saving
    const passwordHash = await bcrypt.hash(input.password, 10);

    // save the new user with the scrambled password
    const user = await userRepository.create({
      name: input.name,
      phone: input.phone,
      passwordHash,
      email: input.email,
    });

    // never send the password hash back out
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },
};
