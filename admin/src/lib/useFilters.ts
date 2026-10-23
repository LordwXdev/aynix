import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// keep filters in the URL (?status=PENDING&page=2)
// so links from the dashboard work and the back button does what you expect
export const useFilters = <K extends string>(keys: K[]) => {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const page = Number(params.get("page")) || 1;

  const set = useCallback(
    (changes: Partial<Record<K | "page", string | number>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === "" || value === undefined || value === null) next.delete(key);
            else next.set(key, String(value));
          }
          // a new filter starts from page 1
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  return { values, page, set };
};
