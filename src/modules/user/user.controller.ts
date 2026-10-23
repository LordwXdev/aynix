import { Request, Response } from "express";
import { userService } from "./user.service.js";
import { AuthRequest } from "../../shared/middleware/auth.js";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

const optionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() : undefined;

export const userController = {
  register: async (req: Request, res: Response) => {
    try {
      const { name, phone, password, email } = req.body ?? {};

      if (!name || !phone || !password) {
        return res.status(400).json({
          error: "name, phone, and password are required",
        });
      }

      const result = await userService.register({
        name: String(name),
        phone: String(phone),
        password: String(password),
        email: optionalString(email),
      });

      return res.status(201).json({
        message: "User registered successfully",
        ...result,
      });
    } catch (err) {
      return res.status(400).json({ error: errorMessage(err) });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { phone, password } = req.body ?? {};

      if (!phone || !password) {
        return res.status(400).json({
          error: "phone and password are required",
        });
      }

      const result = await userService.login({
        phone: String(phone),
        password: String(password),
      });

      return res.status(200).json({
        message: "Login successful",
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        // kept so older clients that read "token" still work
        token: result.accessToken,
      });
    } catch (err) {
      return res.status(401).json({ error: errorMessage(err) });
    }
  },

  // POST /api/users/refresh  { refreshToken }
  refresh: async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken is required" });
      }
      const tokens = await userService.refresh(String(refreshToken));
      return res.status(200).json(tokens);
    } catch (err) {
      return res.status(401).json({ error: errorMessage(err) });
    }
  },

  // POST /api/users/logout  { refreshToken }
  logout: async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      await userService.logout(String(refreshToken));
    }
    return res.status(200).json({ message: "Logged out" });
  },

  // POST /api/users/logout-all
  logoutAll: async (req: AuthRequest, res: Response) => {
    await userService.logoutEverywhere(req.user!.userId);
    return res.status(200).json({ message: "Logged out on all devices" });
  },

  // get the logged-in user's own profile
  getProfile: async (req: AuthRequest, res: Response) => {
    try {
      // req.user was set by the auth gatekeeper
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await userService.getProfile(userId);

      return res.status(200).json({ user });
    } catch (err) {
      return res.status(404).json({ error: errorMessage(err) });
    }
  },

  // PATCH /api/users/me
  updateProfile: async (req: AuthRequest, res: Response) => {
    const body = req.body ?? {};
    const user = await userService.updateProfile(req.user!.userId, {
      name: optionalString(body.name),
      email: optionalString(body.email),
      address: optionalString(body.address),
      city: optionalString(body.city),
      department: optionalString(body.department),
    });
    return res.status(200).json({ user });
  },
};
