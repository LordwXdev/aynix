import { prisma } from "../../shared/database/prisma.js";
import { runIfLeader, LockName } from "../../shared/database/locks.js";
import { logger } from "../../shared/logger.js";
import { deliveryService } from "../delivery/delivery.service.js";

const DAY = 24 * 60 * 60 * 1000;

// delete data we no longer need, so tables stay small and fast
const cleanup = async () => {
  const now = Date.now();
  const [tokens, keys, letters] = await Promise.all([
    // expired sessions, and used ones older than a week
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now) } },
          { revokedAt: { lt: new Date(now - 7 * DAY) } },
        ],
      },
    }),
    // a retry never comes a day later
    prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now - DAY) } } }),
    prisma.deadLetter.deleteMany({ where: { resolvedAt: { lt: new Date(now - 30 * DAY) } } }),
  ]);
  return { tokens: tokens.count, idempotencyKeys: keys.count, deadLetters: letters.count };
};

interface Job {
  name: string;
  lock: LockName;
  everyMs: number;
  run: () => Promise<unknown>;
}

const JOBS: Job[] = [
  // jobs nobody took yet: try again to find a driver
  { name: "assign-waiting-deliveries", lock: "cronAssignWaiting", everyMs: 60_000, run: () => deliveryService.assignWaiting() },
  { name: "cleanup", lock: "cronCleanup", everyMs: 60 * 60_000, run: cleanup },
];

// start every job on a timer. with several servers, only one runs each job at a time
export const startJobs = () => {
  const timers = JOBS.map((job) => {
    const tick = async () => {
      const started = Date.now();
      try {
        const result = await runIfLeader(job.lock, job.run);
        if (result !== null) {
          logger.debug({ job: job.name, ms: Date.now() - started, result }, "job done");
        }
      } catch (err) {
        logger.error({ job: job.name, err }, "job failed");
      }
    };
    const timer = setInterval(() => void tick(), job.everyMs);
    timer.unref();
    return timer;
  });
  return () => timers.forEach(clearInterval);
};

export { cleanup as runCleanup };
