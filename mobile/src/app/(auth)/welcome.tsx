import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, IconName, T } from "@/components/ui";
import { colors, radius, space } from "@/theme";

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "storefront", title: "Shop local stores", text: "Food, fashion, phones and more from sellers across Haiti." },
  { icon: "bicycle", title: "Delivered to your door", text: "A driver picks up your order and brings it to you." },
  { icon: "cash", title: "Pay on delivery", text: "Pay in cash when your order arrives. No card needed." },
];

export default function Welcome() {
  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.hero} edges={["top"]}>
        <View style={styles.logo}>
          <T v="display" style={{ color: colors.primary, fontSize: 34 }}>
            A
          </T>
        </View>
        <T v="display" style={styles.heroTitle}>
          Aynix
        </T>
        <T v="body" style={styles.heroText}>
          Haiti’s marketplace. Buy from local stores, sell your products, or deliver and earn.
        </T>
      </SafeAreaView>

      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={{ gap: space.lg }}>
          {POINTS.map((p) => (
            <View key={p.title} style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name={p.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{p.title}</T>
                <T v="small">{p.text}</T>
              </View>
            </View>
          ))}
        </View>
        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <Button title="Create an account" onPress={() => router.push("/register")} />
          <Button title="I already have an account" kind="secondary" onPress={() => router.push("/login")} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.primary },
  hero: { flex: 1, padding: space.xxl, justifyContent: "flex-end", gap: space.md, minHeight: 260 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  heroTitle: { color: "#fff", fontSize: 40 },
  heroText: { color: "#DCE5FB", fontSize: 17, lineHeight: 24, maxWidth: 340 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: space.xxl,
    paddingBottom: space.xl,
  },
  point: { flexDirection: "row", gap: space.md, alignItems: "center" },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
