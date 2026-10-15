import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import { ProductGrid } from "@/components/product";
import { Button, Empty, ErrorText, Header, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import type { Store } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: store, error, loading, refreshing, refresh } = useAsync(
    () => api.get<{ store: Store }>(`/api/vendors/${slug}`).then((r) => r.store),
    [slug]
  );

  // send people to WhatsApp, the way most Haitian stores talk to customers
  const whatsapp = store?.whatsapp?.replace(/[^\d]/g, "");

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="" />
      <ErrorText error={error} />
      {loading && <Loading />}
      {store && (
        <>
          <View style={styles.hero}>
            <View style={styles.logo}>
              <T v="display" style={{ color: colors.primary }}>
                {store.storeName.charAt(0).toUpperCase()}
              </T>
            </View>
            <T v="title" style={{ color: "#fff", textAlign: "center" }}>
              {store.storeName}
            </T>
            {(store.city || store.department) && (
              <Row>
                <Ionicons name="location" size={14} color="#DCE5FB" />
                <T v="small" style={{ color: "#DCE5FB" }}>
                  {[store.city, store.department].filter(Boolean).join(", ")}
                </T>
              </Row>
            )}
          </View>
          {!!store.description && (
            <T v="body" style={{ color: colors.text2, marginTop: space.lg }}>
              {store.description}
            </T>
          )}
          {whatsapp && (
            <Button
              title="Message on WhatsApp"
              icon="logo-whatsapp"
              kind="secondary"
              onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)}
              style={{ marginTop: space.lg }}
            />
          )}
          <T v="heading" style={{ marginTop: space.xl, marginBottom: space.md }}>
            Products ({store.products.length})
          </T>
          {store.products.length === 0 ? (
            <Empty icon="cube-outline" title="No products yet" text="This store is still setting up." />
          ) : (
            <ProductGrid products={store.products.map((p) => ({ ...p, vendor: undefined }))} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: "center",
    gap: space.sm,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
