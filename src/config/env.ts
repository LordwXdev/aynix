import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// read a required setting, stop the app early if it is missing
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in environment`);
  }
  return value;
};

const isProduction = process.env.NODE_ENV === "production";

const packageVersion = () => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version as string;
  } catch {
    return "dev";
  }
};

// in production, refuse weak or example secrets so a mistake can't go live
const secret = (name: string): string => {
  const value = required(name);
  if (isProduction && (value.length < 32 || /change_me|secret/i.test(value))) {
    throw new Error(`${name} is too weak for production (use 32+ random characters)`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: secret("JWT_SECRET"),
  // during a key change, tokens signed with the old key keep working until they expire
  jwtSecretPrevious: process.env.JWT_SECRET_PREVIOUS || null,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? required("JWT_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  // comma separated list, "*" allows any origin (fine for local dev)
  corsOrigins: (process.env.CORS_ORIGINS ?? "*").split(",").map((o) => o.trim()),
  // money rules, easy to change without touching code
  commissionPercent: Number(process.env.COMMISSION_PERCENT ?? 10),
  deliveryFee: Number(process.env.DELIVERY_FEE ?? 0),
  // login / sign up / refresh attempts allowed per IP every 15 minutes
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  // database connections: how many at once, and how long a query may run
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  dbStatementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 10_000,
  // a request that takes longer than this is cut off
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 15_000,
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  version: process.env.APP_VERSION ?? packageVersion(),
  isProduction,
};
