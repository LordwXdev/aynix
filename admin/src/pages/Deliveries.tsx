import { useCallback, useState } from "react";
import { api } from "../api/client";
import type { DeliveryRow, Paged } from "../api/types";
import { AssignDriver } from "../components/AssignDriver";
import { Badge } from "../components/Badge";
import { OrderDrawer } from "../components/OrderDrawer";
import { Pager } from "../components/Pager";
import { StatusTabs } from "../components/StatusTabs";
import { useToast } from "../components/Toast";
import { dateTime, money, timeAgo } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useFilters } from "../lib/useFilters";
import { useLiveEvent } from "../realtime/socket";

export const Deliveries = () => {
  const { values, page, set } = useFilters(["status", "open"]);
  const toast = useToast();
  const [assigning, setAssigning] = useState<DeliveryRow | null>(null);

  const { data, error, reload } = useAsync(
    () => api.get<Paged<DeliveryRow>>("/api/admin/deliveries", { status: values.status, page, limit: 20 }),
    [values.status, page]
  );

  const onLive = useCallback(() => void reload(), [reload]);
  useLiveEvent("admin:delivery", onLive);

  const findDriver = async (d: DeliveryRow) => {
    try {
      const result = await api.post<{ assigned: boolean }>(`/api/admin/deliveries/${d.id}/auto-assign`);
      toast(result.assigned ? "Driver found and assigned" : "No free driver in this department right now", !result.assigned);
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", true);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Deliveries</h1>
      </div>
      <div className="toolbar">
        <StatusTabs
          options={["WAITING_FOR_DRIVER", "ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED", "CANCELLED"]}
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
                <th>Order</th>
                <th>Deliver to</th>
                <th>Driver</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a
                      href="#"
                      className="mono"
                      style={{ fontWeight: 600 }}
                      onClick={(e) => {
                        e.preventDefault();
                        set({ open: d.orderId, page });
                      }}
                    >
                      {d.order.orderNumber}
                    </a>
                    <div className="small muted">created {dateTime(d.createdAt)}</div>
                  </td>
                  <td>
                    {d.order.deliveryCity}, {d.order.deliveryDepartment}
                  </td>
                  <td>
                    {d.driver ? (
                      <>
                        <div>{d.driver.user.name}</div>
                        <div className="small muted">seen {timeAgo(d.driver.lastSeenAt)}</div>
                      </>
                    ) : (
                      <span className="muted">
                        None
                        {d.declinedDriverIds.length > 0 && ` · ${d.declinedDriverIds.length} declined`}
                      </span>
                    )}
                  </td>
                  <td>
                    <Badge status={d.status} />
                    {d.failReason && <div className="small muted">{d.failReason}</div>}
                  </td>
                  <td className="num">{money(d.order.total)}</td>
                  <td className="num">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      {d.status === "WAITING_FOR_DRIVER" && (
                        <button className="btn sm" onClick={() => void findDriver(d)}>
                          Find driver
                        </button>
                      )}
                      {["WAITING_FOR_DRIVER", "ASSIGNED", "FAILED"].includes(d.status) && (
                        <button className="btn sm" onClick={() => setAssigning(d)}>
                          {d.driver ? "Reassign" : "Assign"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="empty">No deliveries here</div>}
        </div>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {assigning && (
        <AssignDriver
          deliveryId={assigning.id}
          department={assigning.order.deliveryDepartment}
          onDone={reload}
          onClose={() => setAssigning(null)}
        />
      )}
      {values.open && (
        <OrderDrawer orderId={values.open} onClose={() => set({ open: "", page })} onChanged={reload} />
      )}
    </>
  );
};
