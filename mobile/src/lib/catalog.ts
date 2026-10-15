import { useEffect, useState } from "react";
import { api } from "./api";
import type { Category } from "./types";

// categories rarely change: load once and share
let cache: Category[] | null = null;
let pending: Promise<Category[]> | null = null;

const loadCategories = () => {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api
      .get<{ categories: Category[] }>("/api/categories")
      .then((r) => (cache = r.categories))
      .finally(() => (pending = null));
  }
  return pending;
};

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  useEffect(() => {
    loadCategories().then(setCategories).catch(() => {});
  }, []);
  const slugOf = (id: string) => categories.find((c) => c.id === id)?.slug;
  return { categories, slugOf };
};
