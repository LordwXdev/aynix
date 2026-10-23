import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const SEND_EVERY_MS = 10_000;
const HEARTBEAT_MS = 5 * 60_000;

export type GpsState = "off" | "waiting" | "on" | "denied" | "error";

// while the driver is online: follow the phone's GPS and send it to Aynix
// so we can match the closest jobs and customers can watch the driver come
export const useDriverGps = (online: boolean) => {
  const [state, setState] = useState<GpsState>("off");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!online) return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    // even without GPS, tell the server we are still here
    const heartbeat = setInterval(() => {
      api.patch("/api/drivers/me/online", { isOnline: true }).catch(() => {});
    }, HEARTBEAT_MS);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") return setState("denied");

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: SEND_EVERY_MS, distanceInterval: 15 },
          (pos) => {
            setState("on");
            const now = Date.now();
            if (now - lastSent.current < SEND_EVERY_MS) return;
            lastSent.current = now;
            api
              .post("/api/drivers/me/location", {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              })
              .catch(() => {});
          },
          () => setState("error")
        );
        if (cancelled) sub.remove();
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      sub?.remove();
      setState("off");
    };
  }, [online]);

  // just went online and no GPS answer yet: "waiting"
  if (!online) return "off";
  return state === "off" ? "waiting" : state;
};
