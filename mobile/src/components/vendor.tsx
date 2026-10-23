import { Ionicons } from "@expo/vector-icons";
import { Linking, View } from "react-native";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import { confirmAction } from "@/lib/useConfirm";
import type { VendorItem } from "@/lib/types";
import { colors, space } from "@/theme";
import { Badge, Button, Card, Row, T } from "./ui";

// one item a customer bought from this store, with what the seller can do next
export const VendorItemCard = ({
  item,
  onChanged,
  onError,
}: {
  item: VendorItem;
  onChanged: () => void;
  onError: (message: string) => void;
}) => {
  const setStatus = async (status: "CONFIRMED" | "CANCELLED") => {
    if (
      status === "CANCELLED" &&
      !(await confirmAction("Cancel this item?", "The customer is told and the stock goes back to your store.", "Cancel item"))
    ) {
      return;
    }
    try {
      await api.patch(`/api/orders/items/${item.id}/status`, { status });
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ justifyContent: "space-between" }}>
        <View>
          <T v="bodyStrong">{item.order.orderNumber}</T>
          <T v="small">{dateTime(item.order.createdAt)}</T>
        </View>
        <Badge
          status={item.status}
          label={item.status === "PENDING" ? "New" : item.status === "CONFIRMED" ? "Ready for pickup" : undefined}
        />
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <T v="heading" style={{ flex: 1 }} numberOfLines={2}>
          {item.quantity} × {item.productName}
        </T>
        <View style={{ alignItems: "flex-end" }}>
          <T v="heading">{money(item.lineTotal)}</T>
          <T v="small">you get {money(item.vendorPayout)}</T>
        </View>
      </Row>
      <Row gap={space.sm} style={{ alignItems: "flex-start" }}>
        <Ionicons name="person-circle-outline" size={18} color={colors.text2} />
        <View style={{ flex: 1 }}>
          <T v="small" style={{ color: colors.text }}>
            {item.order.customer.name} · {item.order.deliveryCity}, {item.order.deliveryDepartment}
          </T>
        </View>
        <Ionicons
          name="call-outline"
          size={18}
          color={colors.primary}
          onPress={() => Linking.openURL(`tel:${item.order.customer.phone}`)}
          accessibilityLabel="Call customer"
        />
      </Row>
      {item.status === "PENDING" && (
        <Row gap={space.sm}>
          <Button title="Cancel" kind="danger" small onPress={() => setStatus("CANCELLED")} style={{ flex: 1 }} />
          <Button title="Confirm" icon="checkmark" small onPress={() => setStatus("CONFIRMED")} style={{ flex: 2 }} />
        </Row>
      )}
      {item.status === "CONFIRMED" && (
        <Row gap={space.sm}>
          <T v="small" style={{ flex: 1 }}>
            A driver will come to pick it up. Keep it packed and ready.
          </T>
          <Button title="Cancel" kind="danger" small onPress={() => setStatus("CANCELLED")} />
        </Row>
      )}
    </Card>
  );
};
