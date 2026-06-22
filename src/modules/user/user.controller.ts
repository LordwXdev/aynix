import { Request, Response } from "express";
import { userService } from "./user.service.js";

export const userController = {
  // handle a signup request
  register: async (req: Request, res: Response) => {
    try {
      const { name, phone, password, email } = req.body;

      // basic check that the required fields are there
      if (!name || !phone || !password) {
        return res.status(400).json({
          error: "name, phone, and password are required",
        });
      }

      const user = await userService.register({ name, phone, password, email });

      return res.status(201).json({
        message: "User registered successfully",
        user,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      return res.status(400).json({ error: message });
    }
  },
};
