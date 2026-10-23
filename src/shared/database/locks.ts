import { Db, prisma } from "./prisma.js";

// Postgres advisory locks: a lock that every server shares through the database,
// so the app can run on several servers without them stepping on each other.
// each name is turned into a number, which is what Postgres locks on
const LOCKS = {
  driverAssignment: 7_001,
  cronCleanup: 7_002,
  cronAssignWaiting: 7_003,
} as const;

export type LockName = keyof typeof LOCKS;

// wait for the lock inside a transaction; it is released when the transaction ends
export const lockInTransaction = async (tx: Db, name: LockName) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCKS[name]})`;
};

// run `work` only if no other server is already doing it right now
// (used for scheduled jobs: one server runs them, the others skip)
export const runIfLeader = async <T>(name: LockName, work: () => Promise<T>) => {
  return prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${LOCKS[name]}) AS locked`;
      if (!row?.locked) return null;
      return work();
    },
    { timeout: 60_000 }
  );
};
