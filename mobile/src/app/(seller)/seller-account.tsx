import { router } from "expo-router";
import { AccountScreen } from "@/components/account";
import { api } from "@/lib/api";
import type { Vendor } from "@/lib/types";

export default function SellerAccount() {
  return (
    <AccountScreen
      items={[
        { icon: "storefront-outline", title: "Store settings", text: "Name, WhatsApp, address and map pin", onPress: () => router.push("/store-settings") },
        {
          icon: "eye-outline",
          title: "See my store like a customer",
          onPress: async () => {
            const { vendor } = await api.get<{ vendor: Vendor }>("/api/vendors/me");
            router.push(`/store/${vendor.storeSlug}`);
          },
        },
      ]}
    />
  );
}
