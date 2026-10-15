// small tools for talking to things that can fail: other services, the network, SMS

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
  }
}

// give up on a slow promise instead of waiting forever
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// exponential backoff with "full jitter": wait a random time up to base * 4^attempt,
// so many clients retrying at once don't all hit the server at the same moment
export const backoffDelay = (attempt: number, baseMs: number, maxMs: number) =>
  Math.round(Math.random() * Math.min(maxMs, baseMs * 4 ** attempt));

// try something a few times before giving up
export const retry = async <T>(
  work: (attempt: number) => Promise<T>,
  options: { attempts?: number; baseMs?: number; maxMs?: number; shouldRetry?: (err: unknown) => boolean } = {}
): Promise<T> => {
  const { attempts = 3, baseMs = 500, maxMs = 10_000, shouldRetry = () => true } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await work(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1 || !shouldRetry(err)) break;
      await sleep(backoffDelay(attempt, baseMs, maxMs));
    }
  }
  throw lastError;
};

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`${name} is unavailable right now (circuit open)`);
  }
}

// circuit breaker: after too many failures in a row, stop calling the broken thing
// for a while ("open"), then let one call through to test it ("half-open").
// this protects Aynix from waiting on a service that is down
export const circuitBreaker = (name: string, options: { failureThreshold?: number; resetMs?: number } = {}) => {
  const { failureThreshold = 5, resetMs = 30_000 } = options;
  let failures = 0;
  let openedAt = 0;
  let state: "closed" | "open" | "half-open" = "closed";

  return {
    get state() {
      return state;
    },
    async call<T>(work: () => Promise<T>): Promise<T> {
      if (state === "open") {
        if (Date.now() - openedAt < resetMs) throw new CircuitOpenError(name);
        state = "half-open";
      }
      try {
        const result = await work();
        failures = 0;
        state = "closed";
        return result;
      } catch (err) {
        failures++;
        if (state === "half-open" || failures >= failureThreshold) {
          state = "open";
          openedAt = Date.now();
        }
        throw err;
      }
    },
  };
};
