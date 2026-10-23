import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { ProductArt, Stepper } from "@/components/product";
import { Badge, Button, Card, ErrorText, Header, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { add, lines } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, error, loading } = useAsync(
    () => api.get<{ product: Product }>(`/api/products/${id}`).then((r) => r.product),
    [id]
  );

  const inCart = lines.find((l) => l.productId === id)?.quantity ?? 0;
  const canShop = user?.role === "CUSTOMER" || user?.role === "ADMIN";
  const left = product ? product.stockQty - inCart : 0;
  const onSale = product?.comparePrice && Number(product.comparePrice) > Number(product.price);

  const addToCart = () => {
    if (!product) return;
    add(product, quantity);
    setAdded(true);
    setQuantity(1);
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Screen
      edges={["top"]}
      footer={
        product && canShop ? (
          added ? (
            <Row gap={space.md}>
              <Button title="Keep shopping" kind="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button title="Go to cart" icon="bag" onPress={() => router.navigate("/cart")} style={{ flex: 1 }} />
            </Row>
          ) : (
            <Row gap={space.md}>
              {left > 0 && <Stepper value={quantity} min={1} max={left} onChange={setQuantity} />}
              <Button
                title={left > 0 ? `Add · ${money(Number(product.price) * quantity)}` : product.stockQty > 0 ? "All in your cart" : "Sold out"}
                icon={left > 0 ? "bag-add" : undefined}
                disabled={left <= 0}
                onPress={addToCart}
                style={{ flex: 1 }}
              />
            </Row>
          )
        ) : undefined
      }
    >
      <Header title="" />
      <ErrorText error={error} />
      {loading && <Loading />}
      {product && (
        <>
          <ProductArt image={product.images?.[0]} categoryId={product.categoryId} rounded={radius.lg} ratio={4 / 3} />
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <T v="title">{product.name}</T>
            <Row style={{ alignItems: "baseline" }}>
              <T v="display" style={{ fontSize: 26, color: onSale ? colors.accent : colors.text }}>
                {money(product.price)}
              </T>
              {onSale && (
                <T v="body" style={{ textDecorationLine: "line-through", color: colors.text3 }}>
                  {money(product.comparePrice)}
                </T>
              )}
            </Row>
            {product.stockQty > 0 && product.stockQty <= 5 ? (
              <Badge status="OUT_OF_STOCK" label={`Only ${product.stockQty} left`} />
            ) : product.stockQty === 0 ? (
              <Badge status="CANCELLED" label="Sold out" />
            ) : (
              <Badge status="ACTIVE" label="In stock" />
            )}
          </View>

          {product.vendor && (
            <Pressable onPress={() => router.push(`/store/${product.vendor!.storeSlug}`)}>
              <Card style={styles.store}>
                <View style={styles.storeIcon}>
                  <Ionicons name="storefront" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="small">Sold by</T>
                  <T v="bodyStrong">{product.vendor.storeName}</T>
                </View>
                <T v="small" style={{ color: colors.primary, fontWeight: "600" }}>
                  Visit store
                </T>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Card>
            </Pressable>
          )}

          {!!product.description && (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              <T v="heading">About this product</T>
              <T v="body" style={{ color: colors.text2 }}>
                {product.description}
              </T>
            </View>
          )}

          <View style={styles.perks}>
            <Row>
              <Ionicons name="cash-outline" size={18} color={colors.good} />
              <T v="small" style={{ color: colors.text }}>Pay cash when it arrives</T>
            </Row>
            <Row>
              <Ionicons name="bicycle-outline" size={18} color={colors.good} />
              <T v="small" style={{ color: colors.text }}>Delivered by a local Aynix driver</T>
            </Row>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  store: { marginTop: space.xl, flexDirection: "row", alignItems: "center", gap: space.md },
  storeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  perks: {
    marginTop: space.xl,
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.goodSoft,
  },
});
