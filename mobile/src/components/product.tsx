import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useCategories } from "@/lib/catalog";
import { categoryArt, money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { colors, radius, shadow, space } from "@/theme";
import { T } from "./ui";

// the product photo, or a friendly category picture if there is none yet
export const ProductArt = ({
  image,
  categoryId,
  size,
  rounded = radius.md,
  ratio = 1,
}: {
  image?: string | null;
  categoryId: string;
  size?: number;
  rounded?: number;
  ratio?: number;
}) => {
  const { slugOf } = useCategories();
  const art = categoryArt(slugOf(categoryId));
  const box = size ? { width: size, height: size } : { width: "100%" as const, aspectRatio: ratio };
  if (image) {
    return <Image source={{ uri: image }} style={[box, { borderRadius: rounded, backgroundColor: art.bg }]} />;
  }
  return (
    <View style={[box, styles.art, { backgroundColor: art.bg, borderRadius: rounded }]}>
      <Text style={{ fontSize: size ? size * 0.45 : 44 }}>{art.emoji}</Text>
    </View>
  );
};

export const ProductCard = ({ product }: { product: Product }) => {
  const onSale = product.comparePrice && Number(product.comparePrice) > Number(product.price);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${money(product.price)}`}
    >
      <ProductArt image={product.images?.[0]} categoryId={product.categoryId} />
      {onSale && (
        <View style={styles.sale}>
          <Text style={styles.saleText}>SALE</Text>
        </View>
      )}
      <View style={{ padding: space.md, gap: 2 }}>
        <T v="bodyStrong" numberOfLines={2} style={{ minHeight: 40 }}>
          {product.name}
        </T>
        {product.vendor && (
          <T v="small" numberOfLines={1}>
            {product.vendor.storeName}
          </T>
        )}
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <T v="heading" style={{ color: onSale ? colors.accent : colors.text }}>
            {money(product.price)}
          </T>
          {onSale && (
            <T v="small" style={{ textDecorationLine: "line-through" }}>
              {money(product.comparePrice)}
            </T>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// two products per row, works on any screen width
export const ProductGrid = ({ products }: { products: Product[] }) => (
  <View style={styles.grid}>
    {products.map((p) => (
      <View key={p.id} style={styles.cell}>
        <ProductCard product={p} />
      </View>
    ))}
  </View>
);

export const Stepper = ({
  value,
  onChange,
  max,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  min?: number;
}) => (
  <View style={styles.stepper}>
    <Pressable
      onPress={() => onChange(Math.max(min, value - 1))}
      style={styles.stepBtn}
      accessibilityRole="button"
      accessibilityLabel="Less"
      hitSlop={6}
    >
      <Ionicons name={value - 1 < 1 && min === 0 ? "trash-outline" : "remove"} size={18} color={colors.text} />
    </Pressable>
    <T v="bodyStrong" style={{ minWidth: 26, textAlign: "center" }}>
      {value}
    </T>
    <Pressable
      onPress={() => onChange(Math.min(max, value + 1))}
      style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}
      disabled={value >= max}
      accessibilityRole="button"
      accessibilityLabel="More"
      hitSlop={6}
    >
      <Ionicons name="add" size={18} color={colors.text} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  art: { alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow },
  sale: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saleText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.sm / 2 },
  cell: { width: "50%", padding: space.sm / 2 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
