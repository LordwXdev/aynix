import { useCallback } from "react";
import { api } from "../api/client";
import type { OrderRow, Paged } from "../api/types";
import { Badge } from "../components/Badge";
import { OrderDrawer } from "../components/OrderDrawer";
import { Pager } from "../components/Pager";
import { SearchBox } from "../components/SearchBox";
import { StatusTabs } from "../components/StatusTabs";
import { dateTime, money } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useFilters } from "../lib/useFilters";
import { useLiveEvent } from "../realtime/socket";

export const Orders = () => {
  const { values, page, set } = useFilters(["status", "q", "open"]);

  const { data, error, reload } = useAsync(
    () =>
      api.get<Paged<OrderRow>>("/api/admin/orders", {
        status: values.status,
        q: values.q,
        page,
        limit: 20,
      }),
    [values.status, values.q, page]
  );

  // new orders show up without pressing refresh (only on the first page)
  const onLive = useCallback(() => {
    if (page === 1) void reload();
  }, [page, reload]);
  useLiveEvent("admin:order", onLive);

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
      </div>
      <div className="toolbar">
        <StatusTabs
          options={["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]}
          value={values.status}
          onChange={(status) => set({ status })}
        />
        <SearchBox value={values.q} placeholder="Order number" onSearch={(q) => set({ q })} />
      </div>
      <div className="card">
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Deliver to</th>
                <th className="num">Total</th>
                <th>Order</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => set({ open: o.id, page })}>
                  <td>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {o.orderNumber}
                    </div>
                    <div className="small muted">
                      {dateTime(o.createdAt)} · {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td>
                    <div>{o.customer.name}</div>
                    <div className="small muted mono">{o.customer.phone}</div>
                  </td>
                  <td>
                    {o.deliveryCity}, {o.deliveryDepartment}
                  </td>
                  <td className="num">{money(o.total)}</td>
                  <td>
                    <Badge status={o.status} />
                  </td>
                  <td>{o.delivery ? <Badge status={o.delivery.status} /> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="empty">No orders here</div>}
        </div>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {values.open && (
        <OrderDrawer orderId={values.open} onClose={() => set({ open: "", page })} onChanged={reload} />
      )}
    </>
  );
};
