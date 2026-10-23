import { createClient } from "redis";
import { logger } from "./logger.js";

// Redis is optional:
// - one server: not needed, everything works in memory
// - several servers: set REDIS_URL so they share live updates and rate-limit counters
const url = process.env.REDIS_URL;

type Client = ReturnType<typeof createClient>;

const make = (name: string): Client => {
  const client = createClient({
    url,
    socket: {
      // reconnect with exponential backoff, at most every 5 seconds
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 5_000),
      connectTimeout: 5_000,
    },
  });
  // log problems instead of crashing; the client keeps trying to reconnect
  client.on("error", (err) => logger.warn({ err, client: name }, "redis error"));
  return client;
};

export const redis = url ? make("main") : null;

// pub/sub needs two extra connections of its own
export const redisPubSub = url ? { pub: make("pub"), sub: make("sub") } : null;

export const connectRedis = async () => {
  if (!redis || !redisPubSub) return false;
  await Promise.all([redis.connect(), redisPubSub.pub.connect(), redisPubSub.sub.connect()]);
  logger.info("connected to redis");
  return true;
};

export const closeRedis = async () => {
  await Promise.allSettled([redis?.quit(), redisPubSub?.pub.quit(), redisPubSub?.sub.quit()]);
};
