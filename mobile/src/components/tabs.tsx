import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { colors } from "@/theme";
import type { IconName } from "./ui";

// shared look for every bottom tab bar
export const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.text3,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 72,
    paddingTop: 6,
    paddingBottom: 12,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const, lineHeight: 14 },
  tabBarBadgeStyle: { backgroundColor: colors.accent, fontSize: 10, fontWeight: "700" as const },
};

export const tabIcon = (name: IconName, active: IconName) => {
  const TabIcon = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={23} color={color as string} />
  );
  return TabIcon;
};
