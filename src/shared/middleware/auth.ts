import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// this shape describes what we pull out of a valid token
interface TokenPayload {
  userId: string;
  role: string;
}

// we add the logged-in user's info onto the request so routes can use it
export interface AuthRequest extends Request {
  user?: TokenPayload;
}

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

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    // verify the token is real and not expired
    const payload = jwt.verify(token, secret) as TokenPayload;

    // attach the user info to the request for the next step to use
    req.user = payload;

    // let the request continue on to the actual route
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
