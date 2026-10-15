import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { ProductArt } from "@/components/product";
import { Badge, Button, Card, Empty, ErrorText, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, space } from "@/theme";

export default function SellerProducts() {
  const { data, error, loading, refreshing, refresh, reload } = useAsync(
    () => api.get<{ products: Product[] }>("/api/products/mine").then((r) => r.products),
    []
  );
  useFocusEffect(useCallback(() => void reload(), [reload]));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
        <T v="display">Products</T>
        <Button title="Add" icon="add" small onPress={() => router.push("/product-form")} />
      </Row>
      <ErrorText error={error} />
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty
          icon="cube-outline"
          title="Add your first product"
          text="Give it a name, a price and how many you have. It takes a minute."
          action={<Button title="Add a product" icon="add" onPress={() => router.push("/product-form")} style={{ alignSelf: "stretch" }} />}
        />
      ) : (
        <View style={{ gap: space.md }}>
          {data?.map((p) => (
            <Card
              key={p.id}
              onPress={() => router.push(`/product-form?id=${p.id}`)}
              style={{ flexDirection: "row", gap: space.md, padding: space.md }}
            >
              <ProductArt image={p.images?.[0]} categoryId={p.categoryId} size={68} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="bodyStrong" numberOfLines={2}>
                  {p.name}
                </T>
                <Row style={{ justifyContent: "space-between" }}>
                  <T v="heading">{money(p.price)}</T>
                  <T v="small" style={p.stockQty === 0 ? { color: colors.danger, fontWeight: "600" } : undefined}>
                    {p.stockQty === 0 ? "No stock" : `${p.stockQty} in stock`}
                  </T>
                </Row>
                <Badge status={p.status} label={p.status === "ACTIVE" ? "Visible" : undefined} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
