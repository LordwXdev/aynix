import { useState } from "react";
import { api } from "../api/client";
import type { DeliveryRow, Driver, Paged } from "../api/types";
import { useAsync } from "../lib/useAsync";
import { humanize, timeAgo } from "../lib/format";
import { Dialog } from "./Overlay";
import { useAction } from "./Toast";

// pick a driver by hand for one delivery
export const AssignDriver = ({
  deliveryId,
  department,
  onDone,
  onClose,
}: {
  deliveryId: string;
  department: string;
  onDone: () => void;
  onClose: () => void;
}) => {
  const run = useAction();
  const [driverId, setDriverId] = useState("");
  const [saving, setSaving] = useState(false);

  // the drivers, and who is already busy on another job
  const { data } = useAsync(async () => {
    const [drivers, assigned, pickedUp] = await Promise.all([
      api.get<Paged<Driver>>("/api/admin/drivers", { status: "ACTIVE", limit: 100 }),
      api.get<Paged<DeliveryRow>>("/api/admin/deliveries", { status: "ASSIGNED", limit: 100 }),
      api.get<Paged<DeliveryRow>>("/api/admin/deliveries", { status: "PICKED_UP", limit: 100 }),
    ]);
    const busy = new Map<string, string>();
    for (const d of [...assigned.items, ...pickedUp.items]) {
      // the driver already on THIS delivery is not "busy elsewhere"
      if (d.driver && d.id !== deliveryId) busy.set(d.driver.id, d.order.orderNumber);
    }
    return { drivers: drivers.items, busy };
  }, [deliveryId]);

  const busy = data?.busy ?? new Map<string, string>();

  // free first, then same department, then online
  const drivers = [...(data?.drivers ?? [])].sort((a, b) => {
    const score = (d: Driver) =>
      (busy.has(d.id) ? 0 : 4) +
      (d.department.toLowerCase() === department.toLowerCase() ? 2 : 0) +
      (d.isOnline ? 1 : 0);
    return score(b) - score(a);
  });
  const freeCount = drivers.filter((d) => !busy.has(d.id)).length;

  const submit = async () => {
    setSaving(true);
    const ok = await run(
      () => api.post(`/api/admin/deliveries/${deliveryId}/assign`, { driverId }),
      "Driver assigned"
    );
    setSaving(false);
    if (ok) {
      onDone();
      onClose();
    }
  };

  return (
    <Dialog title="Assign a driver" onClose={onClose}>
      <div className="stack">
        <label className="field">
          Driver
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">{data ? "Choose a driver" : "Loading…"}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} disabled={busy.has(d.id)}>
                {d.user.name} · {humanize(d.vehicleType)} · {d.department} ·{" "}
                {busy.has(d.id)
                  ? `busy with ${busy.get(d.id)}`
                  : d.isOnline
                    ? "online"
                    : `offline, seen ${timeAgo(d.lastSeenAt)}`}
              </option>
            ))}
          </select>
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          {data && freeCount === 0
            ? "Every approved driver is on a job right now. Try again when one finishes."
            : "The driver gets a message right away. Drivers already on a job are greyed out."}
        </p>
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>
            Back
          </button>
          <button className="btn primary" disabled={!driverId || saving} onClick={submit}>
            Assign
          </button>
        </div>
      </div>
    </Dialog>
  );
};
