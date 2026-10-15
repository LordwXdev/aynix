// every SMS company we plug in later (Digicel, Natcom, Twilio...) just
// needs to match this shape
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

// for development: print the SMS instead of sending it
const consoleProvider: SmsProvider = {
  async send(phone, message) {
    console.log(`[sms] to ${phone}: ${message}`);
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

export const sms = pickProvider();
