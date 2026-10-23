import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { JobCard } from "@/components/job";
import { ErrorText, IconButton, Loading, Notice, Row, Screen, T } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveEvent } from "@/lib/realtime";
import type { Driver, Job } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useDriverGps } from "@/lib/useDriverGps";
import { useUnread } from "@/lib/useUnread";
import { colors, radius, shadow, space } from "@/theme";

const GPS_TEXT = {
  off: "",
  waiting: "Finding your GPS…",
  on: "GPS on · customers can follow you",
  denied: "Location is off. Turn it on so we can send you nearby jobs.",
  error: "GPS problem. Jobs still come, but matching is less precise.",
};

export default function DriverHome() {
  const { user } = useAuth();
  const unread = useUnread();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, refreshing, refresh, reload, setData } = useAsync(async () => {
    const [{ driver }, { deliveries }] = await Promise.all([
      api.get<{ driver: Driver }>("/api/drivers/me"),
      api.get<{ deliveries: Job[] }>("/api/deliveries/mine", { active: true }),
    ]);
    return { driver, jobs: deliveries };
  }, []);

  const online = !!data?.driver.isOnline;
  const gps = useDriverGps(online);

  useFocusEffect(useCallback(() => void reload(), [reload]));
  // a new job or a cancelled one arrives live
  const onLive = useCallback(() => void reload(), [reload]);
  useLiveEvent("notification", onLive);
  useLiveEvent("delivery:update", onLive);

  const toggle = async () => {
    if (!data) return;
    setActionError(null);
    try {
      const { driver } = await api.patch<{ driver: Driver }>("/api/drivers/me/online", { isOnline: !online });
      setData({ ...data, driver });
      if (driver.isOnline) setTimeout(() => void reload(), 1500); // a waiting job may come right away
    } catch (err) {
      setActionError(errorText(err));
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const d = data?.driver;
  const approved = d?.status === "ACTIVE";

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <T v="small">Aynix Move</T>
          <T v="title" numberOfLines={1}>
            {user?.name.split(" ")[0]}
          </T>
        </View>
        <IconButton icon="notifications-outline" label="Notifications" badge={unread} onPress={() => router.push("/notifications")} />
      </Row>

      <ErrorText error={error} />
      {d?.status === "PENDING" && (
        <Notice tone="warning" icon="time" title="Your application is being reviewed">
          We’ll text you as soon as you’re approved. Then you can go online and get jobs.
        </Notice>
      )}
      {(d?.status === "SUSPENDED" || d?.status === "REJECTED") && (
        <Notice tone="danger" icon="alert-circle" title={d.status === "SUSPENDED" ? "Your account is suspended" : "Your application was not approved"}>
          Contact Aynix support to learn more.
        </Notice>
      )}

      {approved && (
        <Pressable
          onPress={toggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: online }}
          style={[styles.toggle, online ? styles.toggleOn : styles.toggleOff]}
        >
          <View style={[styles.knob, online && { backgroundColor: colors.good }]}>
            <Ionicons name={online ? "radio" : "power"} size={26} color={online ? "#fff" : colors.text2} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="title" style={{ color: online ? "#fff" : colors.text }}>
              {online ? "You're online" : "You're offline"}
            </T>
            <T v="small" style={{ color: online ? "#D7F5E0" : colors.text2 }}>
              {online ? "Jobs come to you automatically. Tap to go offline." : "Tap to go online and start getting jobs."}
            </T>
          </View>
        </Pressable>
      )}
      {online && gps !== "off" && (
        <Row style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>
          <Ionicons
            name={gps === "on" ? "navigate" : "navigate-outline"}
            size={14}
            color={gps === "on" ? colors.good : colors.warning}
          />
          <T v="small" style={{ color: gps === "on" ? colors.good : colors.warning, flex: 1 }}>
            {GPS_TEXT[gps]}
          </T>
        </Row>
      )}
      <View style={{ marginTop: space.md }}>
        <ErrorText error={actionError} />
      </View>

      <View style={{ marginTop: space.lg, gap: space.lg }}>
        {data?.jobs.map((job) => <JobCard key={job.id} job={job} onChanged={reload} />)}
        {approved && data?.jobs.length === 0 && (
          <View style={styles.waiting}>
            <View style={styles.waitingIcon}>
              <Ionicons name={online ? "hourglass-outline" : "moon-outline"} size={30} color={colors.primary} />
            </View>
            <T v="heading" style={{ textAlign: "center" }}>
              {online ? "Waiting for a job" : "No job right now"}
            </T>
            <T v="small" style={{ textAlign: "center", maxWidth: 280 }}>
              {online
                ? "When a store confirms an order near you, it shows up here and we send you a text."
                : "Go online when you're ready to deliver."}
            </T>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    ...shadow,
  },
  toggleOn: { backgroundColor: colors.good },
  toggleOff: { backgroundColor: colors.surface },
  knob: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  waiting: { alignItems: "center", gap: space.md, paddingVertical: space.xxl },
  waitingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
