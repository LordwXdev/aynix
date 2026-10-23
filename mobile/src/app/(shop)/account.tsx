import { router } from "expo-router";
import { AccountScreen } from "@/components/account";

export default function ShopAccount() {
  return (
    <AccountScreen
      items={[
        {
          icon: "storefront",
          title: "Sell on Aynix",
          text: "Open your own store and reach customers all over Haiti",
          onPress: () => router.push("/become-seller"),
          highlight: true,
        },
        {
          icon: "bicycle",
          title: "Drive with Aynix Move",
          text: "Deliver orders and earn on your own time",
          onPress: () => router.push("/become-driver"),
          highlight: true,
        },
      ]}
    />
  );
}
