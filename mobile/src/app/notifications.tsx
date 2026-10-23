import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Empty, ErrorText, Header, IconName, Loading, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { useLiveEvent } from "@/lib/realtime";
import type { Notification } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

const ICONS: Record<string, IconName> = {
  "order.placed": "receipt",
  "order.status": "cube",
  "order.driver_assigned": "bicycle",
  "order.delivery_failed": "warning",
  "vendor.new_order": "storefront",
  "vendor.status": "storefront",
  "driver.new_job": "bicycle",
  "driver.job_cancelled": "close-circle",
  "driver.status": "id-card",
};

export default function Notifications() {
  const { user } = useAuth();
  const { data, error, loading, refreshing, refresh, reload } = useAsync(
    () => api.get<{ items: Notification[]; unread: number }>("/api/notifications", { limit: 50 }),
    []
  );

  // opening the screen marks everything as read
  useFocusEffect(
    useCallback(() => {
      api.post("/api/notifications/read-all").catch(() => {});
    }, [])
  );
  useLiveEvent("notification", useCallback(() => void reload(), [reload]));

  // tap a notification to go where it matters
  const open = (n: Notification) => {
    const orderId = n.data?.orderId;
    if (!orderId) return;
    if (user?.role === "VENDOR") router.navigate("/seller-orders");
    else if (user?.role === "DRIVER") router.navigate("/driver");
    else router.push(`/order/${orderId}`);
  };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="Notifications" />
      <ErrorText error={error} />
      {loading && !data ? (
        <Loading />
      ) : data?.items.length === 0 ? (
        <Empty icon="notifications-outline" title="Nothing yet" text="Order updates and messages will show up here." />
      ) : (
        <View style={{ gap: space.sm }}>
          {data?.items.map((n) => (
            <Pressable key={n.id} onPress={() => open(n)} style={[styles.item, !n.readAt && styles.unread]}>
              <View style={styles.icon}>
                <Ionicons name={ICONS[n.type] ?? "notifications"} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong">{n.title}</T>
                <T v="small" style={{ color: colors.text }}>{n.body}</T>
                <T v="small" style={{ color: colors.text3 }}>{timeAgo(n.createdAt)}</T>
              </View>
              {!n.readAt && <View style={styles.dot} />}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  unread: { backgroundColor: colors.primarySoft },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 },
});
