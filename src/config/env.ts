import "dotenv/config";

// read a required setting, stop the app early if it is missing
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in environment`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
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
  isProduction: process.env.NODE_ENV === "production",
};
