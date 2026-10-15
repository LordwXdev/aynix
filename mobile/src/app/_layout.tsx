import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { RealtimeProvider } from "@/lib/realtime";
import { colors } from "@/theme";

// one app, four worlds: who you are decides which screens exist for you
const Routes = () => {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const role = user?.role;
  const shopper = role === "CUSTOMER" || role === "ADMIN";

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={shopper}>
        <Stack.Screen name="(shop)" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="become-seller" />
        <Stack.Screen name="become-driver" />
      </Stack.Protected>

      <Stack.Protected guard={role === "VENDOR"}>
        <Stack.Screen name="(seller)" />
        <Stack.Screen name="product-form" />
        <Stack.Screen name="store-settings" />
      </Stack.Protected>

      <Stack.Protected guard={role === "DRIVER"}>
        <Stack.Screen name="(driver)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="store/[slug]" />
        <Stack.Screen name="notifications" />
      </Stack.Protected>
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RealtimeProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <Routes />
          </CartProvider>
        </RealtimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
