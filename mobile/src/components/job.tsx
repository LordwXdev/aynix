import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { api, errorText } from "@/lib/api";
import { money } from "@/lib/format";
import { confirmAction } from "@/lib/useConfirm";
import type { Job } from "@/lib/types";
import { colors, radius, space } from "@/theme";
import { Badge, Button, Card, Chip, ErrorText, Row, T } from "./ui";

const FAIL_REASONS = ["Customer not home", "Wrong address", "Customer refused", "Could not reach customer"];

const call = (phone: string) => Linking.openURL(`tel:${phone}`);

const Stop = ({
  n,
  done,
  title,
  name,
  lines,
  phone,
}: {
  n: number;
  done: boolean;
  title: string;
  name: string;
  lines: string[];
  phone?: string | null;
}) => (
  <View style={styles.stop}>
    <View style={[styles.stopNum, done && { backgroundColor: colors.good }]}>
      {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <T v="bodyStrong" style={{ color: "#fff" }}>{n}</T>}
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <T v="tiny">{title}</T>
      <T v="heading">{name}</T>
      {lines.filter(Boolean).map((l) => (
        <T key={l} v="small" style={{ color: colors.text }}>
          {l}
        </T>
      ))}
    </View>
    {phone && (
      <Button title="Call" icon="call" kind="secondary" small onPress={() => call(phone)} />
    )}
  </View>
);

// everything a driver needs for one delivery, and the buttons to move it forward
export const JobCard = ({ job, onChanged }: { job: Job; onChanged: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const [failing, setFailing] = useState(false);
  const o = job.order;
  const pickedUp = job.status === "PICKED_UP";

  // group items by store: one pickup stop per store
  const stores = new Map<string, { vendor: Job["order"]["items"][number]["vendor"]; items: string[] }>();
  for (const item of o.items) {
    const stop = stores.get(item.vendor.id) ?? { vendor: item.vendor, items: [] };
    stop.items.push(`${item.quantity} × ${item.productName}`);
    stores.set(item.vendor.id, stop);
  }

  const act = async (path: string, body?: unknown) => {
    setError(null);
    try {
      await api.post(`/api/deliveries/${job.id}/${path}`, body);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const decline = async () => {
    if (await confirmAction("Decline this job?", "We'll give it to another driver.", "Decline")) await act("decline");
  };

  return (
    <Card style={{ gap: space.lg, padding: 0, overflow: "hidden" }}>
      <View style={styles.top}>
        <T v="tiny" style={{ color: "#B9C8F3" }}>
          {pickedUp ? "DELIVER TO CUSTOMER" : "NEW JOB · PICK UP"}
        </T>
        <T v="heading" style={{ color: "#fff" }} numberOfLines={1}>
          {o.orderNumber}
        </T>
        <View style={styles.cash}>
          <Ionicons name="cash" size={20} color={colors.good} />
          <T v="small" style={{ color: colors.text, flex: 1 }}>Collect in cash</T>
          <T v="title" style={{ color: colors.text }}>{money(o.total)}</T>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        {[...stores.values()].map((s, i) => (
          <Stop
            key={s.vendor.id}
            n={i + 1}
            done={pickedUp}
            title="PICK UP FROM"
            name={s.vendor.storeName}
            lines={[[s.vendor.address, s.vendor.city].filter(Boolean).join(", "), s.items.join(" · ")]}
            phone={s.vendor.whatsapp ?? s.vendor.user.phone}
          />
        ))}
        <Stop
          n={stores.size + 1}
          done={false}
          title="DELIVER TO"
          name={o.customer.name}
          lines={[
            `${o.deliveryAddress}, ${o.deliveryCity}`,
            o.deliveryNotes ? `“${o.deliveryNotes}”` : "",
          ]}
          phone={o.customer.phone}
        />
      </View>

      <View style={{ padding: space.lg, paddingTop: 0, gap: space.sm }}>
        <ErrorText error={error} />
        {job.status === "ASSIGNED" && (
          <>
            <Button title="I picked it up" icon="cube" onPress={() => act("pickup")} />
            <Button title="Decline this job" kind="ghost" onPress={decline} />
          </>
        )}
        {pickedUp && !failing && (
          <>
            <Button title={`Delivered · ${money(o.total)} collected`} icon="checkmark-circle" kind="success" onPress={() => act("deliver")} />
            <Button title="I couldn't deliver" kind="ghost" onPress={() => setFailing(true)} />
          </>
        )}
        {pickedUp && failing && (
          <View style={styles.failBox}>
            <T v="bodyStrong">What happened?</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {FAIL_REASONS.map((r) => (
                <Chip key={r} label={r} onPress={() => act("fail", { reason: r })} />
              ))}
            </View>
            <Button title="Back" kind="ghost" small onPress={() => setFailing(false)} />
          </View>
        )}
      </View>
    </Card>
  );
};

export const JobRow = ({ job }: { job: Job }) => (
  <Card style={{ gap: space.sm }}>
    <Row style={{ justifyContent: "space-between" }}>
      <T v="bodyStrong">{job.order.orderNumber}</T>
      <Badge status={job.status} />
    </Row>
    <T v="small" numberOfLines={1}>
      {job.order.items[0]?.vendor.storeName} → {job.order.customer.name}, {job.order.deliveryCity}
    </T>
    <T v="heading">{money(job.order.total)}</T>
  </Card>
);

const styles = StyleSheet.create({
  top: { backgroundColor: colors.primary, padding: space.lg, gap: 2 },
  cash: {
    marginTop: space.md,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  stop: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stopNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  failBox: { gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
});
