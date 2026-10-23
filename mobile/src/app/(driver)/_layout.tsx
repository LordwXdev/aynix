import Tabs from "expo-router/js-tabs";
import { tabIcon, tabOptions } from "@/components/tabs";

export default function DriverTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="driver" options={{ title: "Jobs", tabBarIcon: tabIcon("navigate-outline", "navigate") }} />
      <Tabs.Screen name="driver-history" options={{ title: "History", tabBarIcon: tabIcon("time-outline", "time") }} />
      <Tabs.Screen name="driver-account" options={{ title: "Account", tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tabs>
  );
}
