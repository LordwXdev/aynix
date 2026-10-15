import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { Badge, Button, Card, Divider, ErrorText, Header, Loading, Notice, Row, Screen, T } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { dateTime, money, timeAgo } from "@/lib/format";
import { useLiveEvent, useSocket } from "@/lib/realtime";
import type { Order, Tracking } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

const VEHICLE: Record<string, string> = { MOTO: "Moto", CAR: "Car", BICYCLE: "Bicycle", FOOT: "On foot" };

// works on phones (Alert) and on the web (confirm)
const ask = (title: string, message: string) =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === "web") return resolve(window.confirm(`${title}\n\n${message}`));
    Alert.alert(title, message, [
      { text: "No", style: "cancel", onPress: () => resolve(false) },
      { text: "Yes, cancel", style: "destructive", onPress: () => resolve(true) },
    ]);
  });

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const socket = useSocket();
  const [error, setError] = useState<string | null>(null);
  const [driverSeen, setDriverSeen] = useState<string | null>(null);

  const { data, loading, reload, refresh, refreshing } = useAsync(async () => {
    const [{ order }, { tracking }] = await Promise.all([
      api.get<{ order: Order }>(`/api/orders/${id}`),
      api.get<{ tracking: Tracking }>(`/api/orders/${id}/tracking`),
    ]);
    return { order, tracking };
  }, [id]);

  // follow this order live while the screen is open
  useEffect(() => {
    if (!socket || !id) return;
    const watch = () => socket.emit("order:watch", { orderId: id });
    watch();
    socket.on("connect", watch);
    return () => {
      socket.off("connect", watch);
      socket.emit("order:unwatch", { orderId: id });
    };
  }, [socket, id]);

  const onUpdate = useCallback(() => void reload(), [reload]);
  useLiveEvent("order:update", onUpdate);
  useLiveEvent("delivery:update", onUpdate);
  useLiveEvent("delivery:location", useCallback(() => setDriverSeen(new Date().toISOString()), []));

  const cancel = async () => {
    if (!(await ask("Cancel this order?", "The stores will be told and nothing will be delivered."))) return;
    try {
      await api.post(`/api/orders/${id}/cancel`);
      await reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <Header title="Order" />
        <Loading />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Header title="Order" />
        <Notice tone="danger" title="Could not load this order" />
      </Screen>
    );
  }

  const { order, tracking } = data;
  const delivery = tracking.delivery;
  const driver = delivery?.driver;
  const ds = delivery?.status;

  // the journey of an order, step by step
  const steps = [
    { title: "Order placed", text: dateTime(order.createdAt), done: true },
    {
      title: "Confirmed by the store",
      text: order.status === "PENDING" ? "Waiting for the store to confirm" : "Your items are ready",
      done: order.status !== "PENDING",
    },
    {
      title: "Driver assigned",
      text:
        ds === "WAITING_FOR_DRIVER"
          ? "Finding the closest driver…"
          : delivery?.assignedAt
            ? dateTime(delivery.assignedAt)
            : "",
      done: !!delivery?.assignedAt || ds === "PICKED_UP" || ds === "DELIVERED",
    },
    {
      title: "On the way to you",
      text: delivery?.pickedUpAt ? dateTime(delivery.pickedUpAt) : "",
      done: !!delivery?.pickedUpAt || ds === "DELIVERED",
    },
    {
      title: "Delivered",
      text: delivery?.deliveredAt ? dateTime(delivery.deliveredAt) : `Pay ${money(order.total)} in cash`,
      done: order.status === "DELIVERED",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  const cancelled = order.status === "CANCELLED";
  const canCancel = (order.status === "PENDING" || order.status === "CONFIRMED") && ds !== "PICKED_UP";

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title={order.orderNumber} />

      {placed && !cancelled && order.status !== "DELIVERED" && (
        <View style={styles.thanks}>
          <Ionicons name="checkmark-circle" size={28} color={colors.good} />
          <View style={{ flex: 1 }}>
            <T v="heading">Thank you! Your order is in.</T>
            <T v="small">We told the store. You can follow every step right here.</T>
          </View>
        </View>
      )}

      {cancelled ? (
        <Notice tone="danger" icon="close-circle" title="This order was cancelled">
          Nothing will be delivered and you pay nothing.
        </Notice>
      ) : ds === "FAILED" ? (
        <Notice tone="warning" icon="warning" title="The driver could not deliver">
          Our team will call you to arrange a new delivery.
        </Notice>
      ) : (
        <Card>
          {steps.map((s, i) => {
            const active = i === current;
            return (
              <View key={s.title} style={styles.step}>
                <View style={{ alignItems: "center" }}>
                  <View
                    style={[
                      styles.dot,
                      s.done && { backgroundColor: colors.primary, borderColor: colors.primary },
                      active && { borderColor: colors.primary },
                    ]}
                  >
                    {s.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                    {active && <View style={styles.pulse} />}
                  </View>
                  {i < steps.length - 1 && (
                    <View style={[styles.line, s.done && { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? space.lg : 0 }}>
                  <T v="bodyStrong" style={{ color: s.done || active ? colors.text : colors.text3 }}>
                    {s.title}
                  </T>
                  {!!s.text && <T v="small">{s.text}</T>}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {driver && (
        <Card style={{ marginTop: space.lg, gap: space.md }}>
          <Row gap={space.md}>
            <View style={styles.driverIcon}>
              <Ionicons name="bicycle" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="small">Your driver</T>
              <T v="heading">{driver.name}</T>
              <T v="small">
                {VEHICLE[driver.vehicleType] ?? driver.vehicleType}
                {driver.plateNumber ? ` · ${driver.plateNumber}` : ""} · seen{" "}
                {timeAgo(driverSeen ?? driver.lastSeenAt)}
              </T>
            </View>
          </Row>
          <Button
            title={`Call ${driver.name.split(" ")[0]}`}
            icon="call"
            kind="secondary"
            onPress={() => Linking.openURL(`tel:${driver.phone}`)}
          />
        </Card>
      )}

      <T v="heading" style={{ marginTop: space.xl, marginBottom: space.md }}>
        Items
      </T>
      <Card>
        {order.items.map((item) => (
          <Row key={item.id} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" numberOfLines={1} style={item.status === "CANCELLED" ? { color: colors.text3, textDecorationLine: "line-through" } : undefined}>
                {item.quantity} × {item.productName}
              </T>
              {item.status === "CANCELLED" && <Badge status="CANCELLED" label="Cancelled by store" />}
            </View>
            <T v="bodyStrong">{money(item.lineTotal)}</T>
          </Row>
        ))}
        <Divider />
        <Row style={{ justifyContent: "space-between" }}>
          <T v="small">Delivery</T>
          <T v="small">{Number(order.deliveryFee) === 0 ? "Free" : money(order.deliveryFee)}</T>
        </Row>
        <Row style={{ justifyContent: "space-between", marginTop: space.sm }}>
          <T v="heading">Total</T>
          <T v="heading">{money(order.total)}</T>
        </Row>
        <Row style={{ marginTop: space.sm }}>
          <Ionicons name="cash-outline" size={16} color={colors.text2} />
          <T v="small">{order.paymentStatus === "PAID" ? "Paid in cash" : "Cash on delivery"}</T>
        </Row>
      </Card>

      <T v="heading" style={{ marginTop: space.xl, marginBottom: space.md }}>
        Delivery address
      </T>
      <Card style={{ flexDirection: "row", gap: space.md }}>
        <Ionicons name="location" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T v="bodyStrong">{order.deliveryAddress}</T>
          <T v="small">
            {order.deliveryCity}, {order.deliveryDepartment}
          </T>
          {order.deliveryNotes && <T v="small">“{order.deliveryNotes}”</T>}
        </View>
      </Card>

      <View style={{ marginTop: space.lg }}>
        <ErrorText error={error} />
      </View>
      {canCancel && (
        <Button title="Cancel order" kind="danger" onPress={cancel} style={{ marginTop: space.lg }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thanks: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.goodSoft,
  },
  step: { flexDirection: "row", gap: space.md },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  line: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.border, marginVertical: 2 },
  driverIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
