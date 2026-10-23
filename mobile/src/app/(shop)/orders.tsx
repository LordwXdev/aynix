import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { Badge, Button, Card, Empty, ErrorText, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import { useLiveEvent } from "@/lib/realtime";
import type { Order } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { space } from "@/theme";

export default function Orders() {
  const { data, error, loading, refreshing, refresh, reload } = useAsync(
    () => api.get<{ orders: Order[] }>("/api/orders").then((r) => r.orders),
    []
  );

  useFocusEffect(useCallback(() => void reload(), [reload]));
  useLiveEvent("order:update", useCallback(() => void reload(), [reload]));

  const active = data?.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED") ?? [];
  const past = data?.filter((o) => o.status === "DELIVERED" || o.status === "CANCELLED") ?? [];

  const renderOrder = (o: Order) => (
    <Card key={o.id} onPress={() => router.push(`/order/${o.id}`)} style={{ gap: space.sm }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T v="bodyStrong">{o.orderNumber}</T>
        <Badge status={o.delivery && o.status !== "DELIVERED" && o.status !== "CANCELLED" ? o.delivery.status : o.status} />
      </Row>
      <T v="small" numberOfLines={1}>
        {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
      </T>
      <Row style={{ justifyContent: "space-between" }}>
        <T v="small">{dateTime(o.createdAt)}</T>
        <T v="heading">{money(o.total)}</T>
      </Row>
    </Card>
  );

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T v="display" style={{ marginBottom: space.lg }}>
        Orders
      </T>
      <ErrorText error={error} />
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty
          icon="receipt-outline"
          title="No orders yet"
          text="When you place an order, you can follow it here from the store to your door."
          action={<Button title="Start shopping" onPress={() => router.navigate("/")} style={{ alignSelf: "stretch" }} />}
        />
      ) : (
        <View style={{ gap: space.md }}>
          {active.length > 0 && <T v="tiny">IN PROGRESS</T>}
          {active.map(renderOrder)}
          {past.length > 0 && <T v="tiny" style={{ marginTop: space.md }}>PAST ORDERS</T>}
          {past.map(renderOrder)}
        </View>
      )}
    </Screen>
  );
}
