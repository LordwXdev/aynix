import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";

// a pool of reusable connections: opening a new one for every query is slow
const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  connectionTimeoutMillis: 5_000, // give up if no connection is free after 5s
  idleTimeoutMillis: 30_000,
  statement_timeout: env.dbStatementTimeoutMs, // stop runaway queries
});

export const prisma = new PrismaClient({ adapter });

// either the normal client or the client inside a transaction
// repositories take this so two modules can share one transaction
export type Db = typeof prisma | Prisma.TransactionClient;
