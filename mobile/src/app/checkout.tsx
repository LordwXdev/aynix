import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Card, ChoiceChips, Divider, ErrorText, Field, Header, Notice, Row, Screen, T } from "@/components/ui";
import { api, errorText, newIdempotencyKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { DEPARTMENTS, money } from "@/lib/format";
import type { Order, User } from "@/lib/types";
import { colors, space } from "@/theme";

export default function Checkout() {
  const { user, setUser } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const [address, setAddress] = useState(user?.address ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [department, setDepartment] = useState<string | null>(user?.department ?? null);
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the same key for every retry of this exact order, so a double tap or a
  // dropped connection never creates two orders. a new key if anything changes
  const orderKey = useRef(newIdempotencyKey());
  useEffect(() => {
    orderKey.current = newIdempotencyKey();
  }, [lines, address, city, department, notes, coords]);

  // optional: the exact spot helps us send the closest driver
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location is off. You can still order with your address.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setError(null);
    } catch {
      setError("Could not get your location. You can still order with your address.");
    } finally {
      setLocating(false);
    }
  };

  const placeOrder = async () => {
    setError(null);
    if (!address.trim() || !city.trim() || !department) {
      setError("Add your address, city and department so the driver can find you");
      return;
    }
    try {
      const { order } = await api.post<{ order: Order }>("/api/orders", {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        deliveryAddress: address.trim(),
        deliveryCity: city.trim(),
        deliveryDepartment: department,
        deliveryNotes: notes.trim() || undefined,
        deliveryLatitude: coords?.lat,
        deliveryLongitude: coords?.lng,
        paymentMethod: "CASH_ON_DELIVERY",
      }, { idempotencyKey: orderKey.current });
      // remember the address for next time
      api
        .patch<{ user: User }>("/api/users/me", { address: address.trim(), city: city.trim(), department })
        .then((r) => setUser(r.user))
        .catch(() => {});
      clear();
      router.replace(`/order/${order.id}?placed=1`);
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (lines.length === 0) {
    return (
      <Screen>
        <Header title="Checkout" />
        <Notice title="Your cart is empty" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          <View style={{ gap: space.md }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T v="body" style={{ color: colors.text2 }}>
                To pay on delivery
              </T>
              <T v="title">{money(subtotal)}</T>
            </Row>
            <Button title="Place order" icon="checkmark-circle" onPress={placeOrder} />
          </View>
        }
      >
        <Header title="Checkout" />

        <T v="heading" style={{ marginBottom: space.md }}>
          Where should we deliver?
        </T>
        <View style={{ gap: space.lg }}>
          <Field label="Street address" value={address} onChangeText={setAddress} placeholder="12 Rue Capois" />
          <Field label="City or area" value={city} onChangeText={setCity} placeholder="Port-au-Prince" />
          <ChoiceChips
            label="Department"
            options={DEPARTMENTS.map((d) => ({ key: d, label: d }))}
            value={department}
            onChange={setDepartment}
          />
          <Field
            label="Notes for the driver (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Blue gate, next to the school"
            multiline
          />
          {coords ? (
            <Notice tone="good" icon="location" title="Exact location added">
              The driver will see where you are.
            </Notice>
          ) : (
            <Button
              title="Add my exact location (optional)"
              icon="locate"
              kind="secondary"
              loading={locating}
              onPress={useMyLocation}
            />
          )}
        </View>

        <T v="heading" style={{ marginTop: space.xxl, marginBottom: space.md }}>
          Your order
        </T>
        <Card>
          {lines.map((l) => (
            <Row key={l.productId} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
              <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                {l.quantity} × {l.name}
              </T>
              <T v="bodyStrong">{money(l.price * l.quantity)}</T>
            </Row>
          ))}
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <T v="body" style={{ color: colors.text2 }}>Delivery</T>
            <T v="body" style={{ color: colors.text2 }}>Shown on your order</T>
          </Row>
        </Card>

        <Card style={{ marginTop: space.md, flexDirection: "row", gap: space.md, alignItems: "center" }}>
          <Ionicons name="cash" size={26} color={colors.good} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Cash on delivery</T>
            <T v="small">Pay the driver when your order arrives.</T>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </Card>

        <View style={{ marginTop: space.lg }}>
          <ErrorText error={error} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
