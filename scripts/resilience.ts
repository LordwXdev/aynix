// checks the safety tools: retry, timeouts, circuit breaker, dead letters and database locks
// needs the database from .env (no server needed). run with: npm run test:resilience
import "dotenv/config";
import assert from "node:assert/strict";
import { retry, withTimeout, TimeoutError, circuitBreaker, CircuitOpenError } from "../src/shared/utils/resilience.js";
import { eventBus } from "../src/shared/events/event-bus.js";
import { prisma } from "../src/shared/database/prisma.js";
import { lockInTransaction, runIfLeader } from "../src/shared/database/locks.js";

const step = (text: string) => console.log(`✔ ${text}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  // retry with exponential backoff: fails twice, works the third time
  let tries = 0;
  const value = await retry(
    async () => {
      tries++;
      if (tries < 3) throw new Error("flaky");
      return "ok";
    },
    { attempts: 3, baseMs: 10 }
  );
  assert.equal(value, "ok");
  assert.equal(tries, 3);
  await assert.rejects(retry(async () => Promise.reject(new Error("down")), { attempts: 2, baseMs: 1 }), /down/);
  step("retry: tries again with backoff, gives up after the last attempt");

  // timeout
  await assert.rejects(withTimeout(sleep(200), 20), TimeoutError);
  assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
  step("timeout: a slow call is cut off");

  // circuit breaker: 3 failures open it, calls fail fast, then it heals
  const breaker = circuitBreaker("test", { failureThreshold: 3, resetMs: 100 });
  for (let i = 0; i < 3; i++) await assert.rejects(breaker.call(() => Promise.reject(new Error("boom"))));
  assert.equal(breaker.state, "open");
  let called = false;
  await assert.rejects(
    breaker.call(async () => {
      called = true;
    }),
    CircuitOpenError
  );
  assert.equal(called, false, "an open circuit must not call the broken service");
  await sleep(120);
  await breaker.call(async () => "back");
  assert.equal(breaker.state, "closed");
  step("circuit breaker: opens after failures, fails fast, closes again when the service is back");

  // dead letters: a listener that keeps failing is saved, and can be replayed
  const on = eventBus.subscriber(`resilience-test-${Date.now()}`);
  let broken = true;
  let handled = 0;
  const driverId = `test-${Date.now()}`;
  on("driver.online", async (payload) => {
    if (payload.driverId !== driverId) return;
    if (broken) throw new Error("listener is broken");
    handled++;
  });
  eventBus.emit("driver.online", { driverId });
  let letter = null;
  for (let i = 0; i < 50 && !letter; i++) {
    await sleep(200);
    letter = await prisma.deadLetter.findFirst({
      where: { event: "driver.online", payload: { path: ["driverId"], equals: driverId } },
    });
  }
  assert.ok(letter, "the failed event must be saved as a dead letter");
  assert.equal(letter.attempts, 3);
  broken = false;
  await eventBus.replay(letter.handler, letter.payload);
  assert.equal(handled, 1);
  await prisma.deadLetter.delete({ where: { id: letter.id } });
  step("dead letters: a failing listener is retried 3 times, saved, then replayed once fixed");

  // database lock: two transactions holding the same lock run one after the other
  const started = Date.now();
  const hold = () =>
    prisma.$transaction(async (tx) => {
      await lockInTransaction(tx, "driverAssignment");
      await sleep(400);
    });
  await Promise.all([hold(), hold()]);
  const took = Date.now() - started;
  assert.ok(took >= 800, `the two transactions must wait for each other (took ${took} ms)`);
  step(`database lock: two holders ran one after the other (${took} ms for 2 × 400 ms)`);

  // leader lock for scheduled jobs: when two servers try at once, only one runs the job
  let runs = 0;
  const job = () =>
    runIfLeader("cronCleanup", async () => {
      runs++;
      await sleep(300);
      return true;
    });
  const results = await Promise.all([job(), job()]);
  assert.equal(runs, 1);
  assert.equal(results.filter((r) => r === null).length, 1);
  step("scheduled jobs: only one server runs a job at a time, the other skips it");

  console.log("\nAll resilience checks passed.");
};

main()
  .catch((err) => {
    console.error("\n✘ Resilience check failed:\n", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
