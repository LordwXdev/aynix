import { router } from "expo-router";
import { View } from "react-native";
import { ProductArt, Stepper } from "@/components/product";
import { Button, Card, Empty, Row, Screen, T } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { colors, space } from "@/theme";

export default function Cart() {
  const { lines, subtotal, count, setQuantity } = useCart();

  if (lines.length === 0) {
    return (
      <Screen>
        <T v="display" style={{ marginBottom: space.lg }}>
          Cart
        </T>
        <Empty
          icon="bag-outline"
          title="Your cart is empty"
          text="Find something you like and tap “Add to cart”."
          action={<Button title="Start shopping" onPress={() => router.navigate("/")} style={{ alignSelf: "stretch" }} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.md }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T v="body" style={{ color: colors.text2 }}>
              Subtotal ({count} item{count === 1 ? "" : "s"})
            </T>
            <T v="title">{money(subtotal)}</T>
          </Row>
          <Button title="Checkout" icon="arrow-forward" onPress={() => router.push("/checkout")} />
        </View>
      }
    >
      <T v="display" style={{ marginBottom: space.lg }}>
        Cart
      </T>
      <View style={{ gap: space.md }}>
        {lines.map((line) => (
          <Card key={line.productId} style={{ flexDirection: "row", gap: space.md, padding: space.md }}>
            <ProductArt image={line.image} categoryId={line.categoryId} size={76} />
            <View style={{ flex: 1, justifyContent: "space-between" }}>
              <View>
                <T v="bodyStrong" numberOfLines={2}>
                  {line.name}
                </T>
                <T v="small">{line.storeName}</T>
              </View>
              <Row style={{ justifyContent: "space-between", marginTop: space.sm }}>
                <T v="heading">{money(line.price * line.quantity)}</T>
                <Stepper
                  value={line.quantity}
                  max={line.stockQty}
                  onChange={(n) => setQuantity(line.productId, n)}
                />
              </Row>
            </View>
          </Card>
        ))}
      </View>
      <T v="small" style={{ marginTop: space.lg, textAlign: "center" }}>
        Delivery cost and the final total are shown at checkout.
      </T>
    </Screen>
  );
}
