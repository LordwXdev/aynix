// a picture link must be a normal web address.
// this blocks tricks like "javascript:..." that could run code in the admin panel
export const isSafeImageUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
