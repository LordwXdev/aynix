import Tabs from "expo-router/js-tabs";
import { tabIcon, tabOptions } from "@/components/tabs";
import { useCart } from "@/lib/cart";

export default function ShopTabs() {
  const { count } = useCart();
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: "Shop", tabBarIcon: tabIcon("home-outline", "home") }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: tabIcon("bag-outline", "bag"),
          tabBarBadge: count > 0 ? count : undefined,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: tabIcon("receipt-outline", "receipt") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tabs>
  );
}
