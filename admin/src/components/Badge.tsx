import { humanize } from "../lib/format";

type Tone = "good" | "warning" | "info" | "critical" | "neutral";

// every status gets a color AND its name written out, never color alone
const TONES: Record<string, Tone> = {
  ACTIVE: "good",
  DELIVERED: "good",
  PAID: "good",
  ONLINE: "good",
  PENDING: "warning",
  WAITING_FOR_DRIVER: "warning",
  CONFIRMED: "info",
  ASSIGNED: "info",
  PICKED_UP: "info",
  SHIPPED: "info",
  SUSPENDED: "critical",
  REJECTED: "critical",
  CANCELLED: "critical",
  FAILED: "critical",
  BANNED: "critical",
  REFUNDED: "neutral",
  OFFLINE: "neutral",
};

export const Badge = ({ status, label }: { status: string; label?: string }) => (
  <span className={`badge ${TONES[status] ?? "neutral"}`}>{label ?? humanize(status)}</span>
);
