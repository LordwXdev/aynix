const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const money = (value: string | number | null | undefined) =>
  `${numberFormat.format(Number(value ?? 0))} HTG`;

export const timeAgo = (value: string | null | undefined) => {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

// Haiti's 10 departments, for address forms
export const DEPARTMENTS = [
  "Ouest",
  "Nord",
  "Artibonite",
  "Sud",
  "Centre",
  "Nord-Est",
  "Nord-Ouest",
  "Sud-Est",
  "Grand'Anse",
  "Nippes",
];

// a friendly picture for each category until stores upload real photos
const CATEGORY_ART: Record<string, { emoji: string; bg: string }> = {
  "food-groceries": { emoji: "🍚", bg: "#FFF1DB" },
  "fashion-clothing": { emoji: "👗", bg: "#FCE7F0" },
  "phones-accessories": { emoji: "📱", bg: "#E6EEFD" },
  electronics: { emoji: "🔌", bg: "#E7F0F7" },
  "beauty-personal-care": { emoji: "💄", bg: "#FDE8EC" },
  "home-kitchen": { emoji: "🏠", bg: "#EAF6EC" },
  "health-pharmacy": { emoji: "💊", bg: "#E8F6F5" },
  "baby-kids": { emoji: "🧸", bg: "#FFF4E0" },
  "agriculture-farm": { emoji: "🌱", bg: "#EAF5E3" },
  "art-crafts": { emoji: "🎨", bg: "#F1EAFB" },
};

export const categoryArt = (slug: string | undefined) =>
  CATEGORY_ART[slug ?? ""] ?? { emoji: "🛍️", bg: "#EEF0F4" };
