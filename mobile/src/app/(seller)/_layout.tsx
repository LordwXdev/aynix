import Tabs from "expo-router/js-tabs";
import { tabIcon, tabOptions } from "@/components/tabs";

export default function SellerTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="seller" options={{ title: "Today", tabBarIcon: tabIcon("sunny-outline", "sunny") }} />
      <Tabs.Screen name="seller-orders" options={{ title: "Orders", tabBarIcon: tabIcon("receipt-outline", "receipt") }} />
      <Tabs.Screen name="seller-products" options={{ title: "Products", tabBarIcon: tabIcon("cube-outline", "cube") }} />
      <Tabs.Screen name="seller-account" options={{ title: "Account", tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tabs>
  );
}
