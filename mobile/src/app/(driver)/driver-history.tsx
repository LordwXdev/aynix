import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { JobRow } from "@/components/job";
import { Empty, ErrorText, Loading, Row, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Job } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

export default function DriverHistory() {
  const { data, error, loading, refreshing, refresh, reload } = useAsync(
    () => api.get<{ deliveries: Job[] }>("/api/deliveries/mine").then((r) => r.deliveries),
    []
  );
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const done = data?.filter((j) => j.status === "DELIVERED") ?? [];
  const collected = done.reduce((sum, j) => sum + Number(j.order.total), 0);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T v="display" style={{ marginBottom: space.lg }}>
        History
      </T>
      <ErrorText error={error} />
      {data && data.length > 0 && (
        <Row gap={space.md} style={{ marginBottom: space.lg }}>
          <View style={{ flex: 1, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.goodSoft }}>
            <T v="display" style={{ color: colors.good }}>{done.length}</T>
            <T v="small" style={{ color: colors.text }}>Delivered</T>
          </View>
          <View style={{ flex: 1, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft }}>
            <T v="heading" style={{ color: colors.primary, marginTop: 6 }}>{money(collected)}</T>
            <T v="small" style={{ color: colors.text, marginTop: 4 }}>Cash collected</T>
          </View>
        </Row>
      )}
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty icon="time-outline" title="No deliveries yet" text="Your finished jobs will show up here." />
      ) : (
        <View style={{ gap: space.md }}>{data?.map((j) => <JobRow key={j.id} job={j} />)}</View>
      )}
    </Screen>
  );
}
