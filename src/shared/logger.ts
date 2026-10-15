import { pino } from "pino";
import { env } from "../config/env.js";

// one JSON line per log, easy to search in any log tool (Grafana Loki, Datadog, CloudWatch…)
// secrets never reach the logs: these fields are replaced with "[hidden]"
export const logger = pino({
  level: env.logLevel,
  base: { service: "aynix-api", version: env.version },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.refreshToken",
      "*.accessToken",
      "*.token",
    ],
    censor: "[hidden]",
  },
});
