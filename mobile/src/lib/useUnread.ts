import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
import { useLiveEvent } from "./realtime";

// how many notifications the user has not read yet, kept fresh live
export const useUnread = () => {
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api
      .get<{ unread: number }>("/api/notifications", { limit: 1 })
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);
  useFocusEffect(load);
  useLiveEvent("notification", load);

  return unread;
};
