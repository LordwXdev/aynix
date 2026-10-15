import { useState } from "react";
import { api } from "../api/client";
import type { Driver, Paged } from "../api/types";
import { Badge } from "../components/Badge";
import { Confirm, PendingConfirm } from "../components/Confirm";
import { Pager } from "../components/Pager";
import { StatusTabs } from "../components/StatusTabs";
import { useAction } from "../components/Toast";
import { humanize, timeAgo } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useFilters } from "../lib/useFilters";

type Status = Driver["status"];

const ACTIONS: Record<Status, { to: Status; label: string; danger?: boolean }[]> = {
  PENDING: [
    { to: "ACTIVE", label: "Approve" },
    { to: "REJECTED", label: "Reject", danger: true },
  ],
  ACTIVE: [{ to: "SUSPENDED", label: "Suspend", danger: true }],
  SUSPENDED: [{ to: "ACTIVE", label: "Reactivate" }],
  REJECTED: [{ to: "ACTIVE", label: "Approve" }],
};

export const Drivers = () => {
  const { values, page, set } = useFilters(["status", "online"]);
  const run = useAction();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const { data, error, reload } = useAsync(
    () => api.get<Paged<Driver>>("/api/admin/drivers", { ...values, page, limit: 20 }),
    [values.status, values.online, page]
  );

  const change = (driver: Driver, to: Status, label: string, danger?: boolean) =>
    setConfirm({
      title: `${label} ${driver.user.name}?`,
      message:
        to === "ACTIVE"
          ? "They can go online and start getting delivery jobs."
          : "They go offline right away and stop getting jobs.",
      confirmLabel: label,
      danger,
      run: async () => {
        if (await run(() => api.patch(`/api/admin/drivers/${driver.id}/status`, { status: to }), `Driver updated`)) {
          await reload();
        }
      },
    });

  return (
    <>
      <div className="page-head">
        <h1>Drivers</h1>
      </div>
      <div className="toolbar">
        <StatusTabs
          options={["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"]}
          value={values.status}
          onChange={(status) => set({ status })}
        />
        <select aria-label="Online" value={values.online} onChange={(e) => set({ online: e.target.value })}>
          <option value="">Online and offline</option>
          <option value="true">Online now</option>
          <option value="false">Offline</option>
        </select>
      </div>
      <div className="card">
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Area</th>
                <th>Status</th>
                <th>Online</th>
                <th className="num">Delivered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.user.name}</div>
                    <div className="small muted mono">{d.user.phone}</div>
                  </td>
                  <td>
                    {humanize(d.vehicleType)}
                    {d.plateNumber && <div className="small muted mono">{d.plateNumber}</div>}
                  </td>
                  <td>
                    {d.city}, {d.department}
                  </td>
                  <td>
                    <Badge status={d.status} />
                  </td>
                  <td>
                    <Badge status={d.isOnline ? "ONLINE" : "OFFLINE"} />
                    <div className="small muted">seen {timeAgo(d.lastSeenAt)}</div>
                  </td>
                  <td className="num">{d._count.deliveries}</td>
                  <td className="num">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      {ACTIONS[d.status].map((a) => (
                        <button
                          key={a.to}
                          className={`btn sm ${a.danger ? "danger" : "good"}`}
                          onClick={() => change(d, a.to, a.label, a.danger)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="empty">No drivers here</div>}
        </div>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {confirm && <Confirm {...confirm} onConfirm={confirm.run} onClose={() => setConfirm(null)} />}
    </>
  );
};
