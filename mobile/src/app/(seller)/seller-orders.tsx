import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { VendorItemCard } from "@/components/vendor";
import { Chip, Empty, ErrorText, Loading, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useLiveEvent } from "@/lib/realtime";
import type { VendorItem } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { space } from "@/theme";

const FILTERS = [
  { key: "PENDING", label: "New" },
  { key: "CONFIRMED", label: "Ready" },
  { key: "SHIPPED", label: "On the way" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function SellerOrders() {
  const [status, setStatus] = useState("PENDING");
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useAsync(
    () => api.get<{ items: VendorItem[] }>("/api/orders/vendor/items", { status }).then((r) => r.items),
    [status]
  );

  useFocusEffect(useCallback(() => void reload(), [reload]));
  useLiveEvent("notification", useCallback(() => void reload(), [reload]));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T v="display" style={{ marginBottom: space.lg }}>
        Orders
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg, marginBottom: space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
      >
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </ScrollView>
      <ErrorText error={error ?? actionError} />
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty icon="receipt-outline" title="Nothing here" text="Orders in this step will show up here." />
      ) : (
        <View style={{ gap: space.md }}>
          {data?.map((item) => (
            <VendorItemCard key={item.id} item={item} onChanged={reload} onError={setActionError} />
          ))}
        </View>
      )}
    </Screen>
  );
}
