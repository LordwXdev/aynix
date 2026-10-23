import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export type Role = "CUSTOMER" | "VENDOR" | "DRIVER" | "ADMIN";

// this shape describes what we pull out of a valid token
export interface TokenPayload {
  userId: string;
  role: Role;
}

// we add the logged-in user's info onto the request so routes can use it
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

// check an access token and return what is inside, or null if it is bad
// to change the signing key without logging everyone out:
// set JWT_SECRET_PREVIOUS to the old key and JWT_SECRET to the new one,
// then remove JWT_SECRET_PREVIOUS once old tokens have expired (15 min)
const VERIFY_KEYS = [env.jwtSecret, env.jwtSecretPrevious].filter(Boolean) as string[];

export const verifyAccessToken = (token: string): TokenPayload | null => {
  for (const key of VERIFY_KEYS) {
    try {
      // clockTolerance: servers' clocks are never perfectly in sync
      return jwt.verify(token, key, { clockTolerance: 30 }) as TokenPayload;
    } catch {
      /* try the next key */
    }
  }
  return null;
};

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // the token comes in the Authorization header like: "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  // grab just the token part, after the word "Bearer"
  const token = authHeader.split(" ")[1];

  // verify the token is real and not expired
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // attach the user info to the request for the next step to use
  req.user = payload;

  // let the request continue on to the actual route
  next();
};

// use after requireAuth: only lets in users with one of these roles
// admins can always pass
export const requireRole =
  (...roles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (role !== "ADMIN" && !roles.includes(role)) {
      return res.status(403).json({ error: "You do not have access to this" });
    }
    next();
  };
