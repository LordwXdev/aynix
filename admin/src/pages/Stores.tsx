import { useState } from "react";
import { api } from "../api/client";
import type { Paged, Vendor } from "../api/types";
import { Badge } from "../components/Badge";
import { Confirm, PendingConfirm } from "../components/Confirm";
import { Pager } from "../components/Pager";
import { StatusTabs } from "../components/StatusTabs";
import { useAction } from "../components/Toast";
import { dateTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useFilters } from "../lib/useFilters";

type Status = Vendor["status"];

// what an admin can do from each status
const ACTIONS: Record<Status, { to: Status; label: string; danger?: boolean }[]> = {
  PENDING: [
    { to: "ACTIVE", label: "Approve" },
    { to: "REJECTED", label: "Reject", danger: true },
  ],
  ACTIVE: [{ to: "SUSPENDED", label: "Suspend", danger: true }],
  SUSPENDED: [{ to: "ACTIVE", label: "Reactivate" }],
  REJECTED: [{ to: "ACTIVE", label: "Approve" }],
};

const MESSAGES: Record<Status, string> = {
  ACTIVE: "The store and its products become visible to shoppers.",
  SUSPENDED: "The store and its products are hidden. No new orders can be placed.",
  REJECTED: "The store stays hidden. The owner gets a message.",
  PENDING: "",
};

export const Stores = () => {
  const { values, page, set } = useFilters(["status"]);
  const run = useAction();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const { data, error, reload } = useAsync(
    () => api.get<Paged<Vendor>>("/api/admin/vendors", { status: values.status, page, limit: 20 }),
    [values.status, page]
  );

  const change = (store: Vendor, to: Status, label: string, danger?: boolean) =>
    setConfirm({
      title: `${label} ${store.storeName}?`,
      message: MESSAGES[to],
      confirmLabel: label,
      danger,
      run: async () => {
        if (await run(() => api.patch(`/api/admin/vendors/${store.id}/status`, { status: to }), `Store ${label.toLowerCase()}d`)) {
          await reload();
        }
      },
    });

  return (
    <>
      <div className="page-head">
        <h1>Stores</h1>
      </div>
      <div className="toolbar">
        <StatusTabs
          options={["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"]}
          value={values.status}
          onChange={(status) => set({ status })}
        />
      </div>
      <div className="card">
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Store</th>
                <th>Owner</th>
                <th>Location</th>
                <th className="num">Products</th>
                <th>Status</th>
                <th>Opened</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.storeName}</div>
                    <div className="small muted">/{s.storeSlug}</div>
                  </td>
                  <td>
                    <div>{s.user.name}</div>
                    <div className="small muted mono">{s.whatsapp ?? s.user.phone}</div>
                  </td>
                  <td>
                    {[s.city, s.department].filter(Boolean).join(", ") || <span className="muted">—</span>}
                    {s.latitude === null && <div className="small muted">no map pin</div>}
                  </td>
                  <td className="num">{s._count.products}</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td className="muted">{dateTime(s.createdAt)}</td>
                  <td className="num">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      {ACTIONS[s.status].map((a) => (
                        <button
                          key={a.to}
                          className={`btn sm ${a.danger ? "danger" : "good"}`}
                          onClick={() => change(s, a.to, a.label, a.danger)}
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
          {data && data.items.length === 0 && <div className="empty">No stores here</div>}
        </div>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {confirm && <Confirm {...confirm} onConfirm={confirm.run} onClose={() => setConfirm(null)} />}
    </>
  );
};
