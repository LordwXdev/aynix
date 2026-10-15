import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { VendorItemCard } from "@/components/vendor";
import { Empty, ErrorText, IconButton, Loading, Notice, Row, Screen, Section, T } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useLiveEvent } from "@/lib/realtime";
import type { Sales, Vendor, VendorItem } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useUnread } from "@/lib/useUnread";
import { colors, radius, space } from "@/theme";

export default function SellerToday() {
  const unread = useUnread();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, refreshing, refresh, reload } = useAsync(async () => {
    const [{ vendor }, { sales }, { items }] = await Promise.all([
      api.get<{ vendor: Vendor }>("/api/vendors/me"),
      api.get<{ sales: Sales }>("/api/orders/vendor/sales"),
      api.get<{ items: VendorItem[] }>("/api/orders/vendor/items", { status: "PENDING" }),
    ]);
    return { vendor, sales, items };
  }, []);

  useFocusEffect(useCallback(() => void reload(), [reload]));
  // a new order arrives as a notification: show it right away
  useLiveEvent("notification", useCallback(() => void reload(), [reload]));

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const v = data?.vendor;
  const s = data?.sales;
  const waiting = s?.itemsByStatus.CONFIRMED ?? 0;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <T v="small">Your store</T>
          <T v="title" numberOfLines={1}>
            {v?.storeName}
          </T>
        </View>
        <IconButton icon="notifications-outline" label="Notifications" badge={unread} onPress={() => router.push("/notifications")} />
      </Row>

      <ErrorText error={error} />
      {v?.status === "PENDING" && (
        <Notice tone="warning" icon="time" title="Your store is waiting for approval">
          Add your products now. Customers will see them as soon as Aynix approves your store.
        </Notice>
      )}
      {v?.status === "SUSPENDED" && (
        <Notice tone="danger" icon="alert-circle" title="Your store is suspended">
          Customers can’t see your products. Contact Aynix support.
        </Notice>
      )}
      {v?.status === "REJECTED" && (
        <Notice tone="danger" icon="close-circle" title="Your store was not approved">
          Contact Aynix support to learn more.
        </Notice>
      )}

      {s && (
        <View style={styles.hero}>
          <T v="small" style={{ color: "#DCE5FB" }}>
            Your earnings from delivered orders
          </T>
          <T v="display" style={{ color: "#fff", fontSize: 34 }}>
            {money(s.delivered.payout)}
          </T>
          <Row gap={space.lg} style={{ marginTop: space.sm }}>
            <View>
              <T v="tiny" style={{ color: "#B9C8F3" }}>SOLD</T>
              <T v="bodyStrong" style={{ color: "#fff" }}>{s.delivered.unitsSold} items</T>
            </View>
            <View>
              <T v="tiny" style={{ color: "#B9C8F3" }}>SALES</T>
              <T v="bodyStrong" style={{ color: "#fff" }}>{money(s.delivered.grossSales)}</T>
            </View>
            <View>
              <T v="tiny" style={{ color: "#B9C8F3" }}>AYNIX FEE</T>
              <T v="bodyStrong" style={{ color: "#fff" }}>{money(s.delivered.commission)}</T>
            </View>
          </Row>
        </View>
      )}

      <Row gap={space.md} style={{ marginTop: space.md }}>
        <View style={[styles.stat, { backgroundColor: colors.warningSoft }]}>
          <T v="display" style={{ color: colors.warning }}>{data?.items.length ?? 0}</T>
          <T v="small" style={{ color: colors.text }}>New, to confirm</T>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.infoSoft }]}>
          <T v="display" style={{ color: colors.info }}>{waiting}</T>
          <T v="small" style={{ color: colors.text }}>Waiting for pickup</T>
        </View>
      </Row>

      <Section title="Confirm these orders" action={{ label: "All orders", onPress: () => router.navigate("/seller-orders") }}>
        <ErrorText error={actionError} />
        {data?.items.length === 0 ? (
          <Empty icon="checkmark-done" title="You're all caught up" text="New orders will show up here. We'll also send you a text." />
        ) : (
          data?.items.map((item) => (
            <VendorItemCard key={item.id} item={item} onChanged={reload} onError={setActionError} />
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: space.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: 2,
  },
  stat: { flex: 1, borderRadius: radius.lg, padding: space.lg, gap: 2 },
});
