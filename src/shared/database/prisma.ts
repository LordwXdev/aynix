import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });

// either the normal client or the client inside a transaction
// repositories take this so two modules can share one transaction
export type Db = typeof prisma | Prisma.TransactionClient;
