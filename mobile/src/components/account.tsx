import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { API_URL } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/theme";
import { Card, IconName, Screen, T } from "./ui";

export interface MenuItem {
  icon: IconName;
  title: string;
  text?: string;
  onPress: () => void;
  highlight?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Seller",
  DRIVER: "Aynix Move driver",
  ADMIN: "Admin",
};

const Row = ({ item, last }: { item: MenuItem; last: boolean }) => (
  <Pressable
    onPress={item.onPress}
    style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
    accessibilityRole="button"
    accessibilityLabel={item.title}
  >
    <View style={[styles.rowIcon, item.highlight && { backgroundColor: colors.primary }]}>
      <Ionicons name={item.icon} size={20} color={item.highlight ? "#fff" : colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <T v="bodyStrong">{item.title}</T>
      {item.text && <T v="small">{item.text}</T>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.text3} />
  </Pressable>
);

export const AccountScreen = ({ items }: { items: MenuItem[] }) => {
  const { user, logout } = useAuth();
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const all: MenuItem[] = [
    ...items,
    { icon: "notifications-outline", title: "Notifications", onPress: () => router.push("/notifications") },
  ];

  return (
    <Screen>
      <T v="display" style={{ marginBottom: space.lg }}>
        Account
      </T>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <View style={styles.avatar}>
          <T v="title" style={{ color: colors.primary }}>
            {initials}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T v="heading">{user?.name}</T>
          <T v="small">{user?.phone}</T>
          <View style={styles.role}>
            <T v="tiny" style={{ color: colors.primary }}>
              {ROLE_LABEL[user?.role ?? ""]?.toUpperCase()}
            </T>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: space.lg, paddingVertical: space.xs }}>
        {all.map((item, i) => (
          <Row key={item.title} item={item} last={i === all.length - 1} />
        ))}
      </Card>

      <Pressable onPress={() => void logout()} style={styles.logout} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <T v="bodyStrong" style={{ color: colors.danger }}>
          Log out
        </T>
      </Pressable>

      <T v="small" style={{ textAlign: "center", marginTop: space.lg, color: colors.text3 }}>
        Aynix · connected to {API_URL}
      </T>
    </Screen>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  role: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logout: {
    marginTop: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
  },
});
