// small helpers to show numbers and dates the same way everywhere

const htg = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const money = (value: string | number | null | undefined) =>
  `${htg.format(Number(value ?? 0))} HTG`;

export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const count = (value: number | undefined) => new Intl.NumberFormat("en-US").format(value ?? 0);

export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export const shortDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const timeAgo = (value: string | null | undefined) => {
  if (!value) return "never";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

// "WAITING_FOR_DRIVER" -> "Waiting for driver"
export const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
