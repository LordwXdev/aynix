import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ProductGrid } from "@/components/product";
import { Chip, Empty, ErrorText, IconButton, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useUnread } from "@/lib/useUnread";
import { colors, radius, space } from "@/theme";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bonjou";
  if (h < 18) return "Bon apremidi";
  return "Bonswa";
};

export default function Home() {
  const { user } = useAuth();
  const unread = useUnread();
  const { categories } = useCategories();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data, error, loading, refreshing, refresh } = useAsync(
    () =>
      api.get<{ items: Product[]; total: number }>("/api/products", {
        q,
        categoryId,
        limit: 40,
      }),
    [q, categoryId]
  );

  const filtering = !!q || !!categoryId;
  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <T v="small">{greeting()},</T>
          <T v="title" numberOfLines={1}>
            {user?.name.split(" ")[0]} 👋
          </T>
        </View>
        <IconButton
          icon="notifications-outline"
          label="Notifications"
          badge={unread}
          onPress={() => router.push("/notifications")}
        />
      </Row>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.text3} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (!t) setQ("");
          }}
          onSubmitEditing={() => setQ(text.trim())}
          placeholder="Search rice, shoes, phones…"
          placeholderTextColor={colors.text3}
          returnKeyType="search"
          style={styles.searchInput}
          accessibilityLabel="Search products"
        />
        {!!text && (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.text3}
            onPress={() => {
              setText("");
              setQ("");
            }}
          />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg, marginTop: space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
      >
        <Chip label="All" active={!categoryId} onPress={() => setCategoryId(null)} />
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      {!filtering && (
        <View style={styles.banner}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="heading" style={{ color: "#fff" }}>
              Pay when it arrives
            </T>
            <T v="small" style={{ color: "#DCE5FB" }}>
              Every order is cash on delivery. A local driver brings it to your door.
            </T>
          </View>
          <View style={styles.bannerIcon}>
            <Ionicons name="bicycle" size={30} color={colors.primary} />
          </View>
        </View>
      )}

      <Row style={{ justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md }}>
        <T v="heading">
          {q ? `Results for “${q}”` : categoryName ?? "Fresh in stores"}
        </T>
        {data && <T v="small">{data.total} items</T>}
      </Row>

      <ErrorText error={error} />
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <Empty
          icon="search"
          title="Nothing found"
          text={filtering ? "Try another word or category." : "Stores are adding products. Check back soon."}
        />
      ) : (
        data && <ProductGrid products={data.items} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: "100%",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  banner: {
    marginTop: space.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
