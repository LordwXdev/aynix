import { circuitBreaker, withTimeout } from "../utils/resilience.js";
import { logger } from "../logger.js";

// every SMS company we plug in later (Digicel, Natcom, Twilio...) just
// needs to match this shape
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

// for development: print the SMS instead of sending it
const consoleProvider: SmsProvider = {
  async send(phone, message) {
    logger.info({ phone, message }, "sms (console provider)");
  },
};

const silentProvider: SmsProvider = {
  async send() {},
};

const pickProvider = (): SmsProvider => {
  switch (process.env.SMS_PROVIDER ?? "console") {
    case "none":
      return silentProvider;
    default:
      return consoleProvider;
  }
};

const provider = pickProvider();

// if the SMS company is down, stop calling it for a while instead of making
// every notification wait; each try is also cut off after 5 seconds
const breaker = circuitBreaker("sms", { failureThreshold: 5, resetMs: 30_000 });

export const sms = {
  send: (phone: string, message: string) =>
    breaker.call(() => withTimeout(provider.send(phone, message), 5_000)),
  get state() {
    return breaker.state;
  },
};
