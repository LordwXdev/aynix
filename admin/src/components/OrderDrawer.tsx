import { useCallback, useState } from "react";
import { api } from "../api/client";
import type { OrderDetail } from "../api/types";
import { useAsync } from "../lib/useAsync";
import { dateTime, humanize, money } from "../lib/format";
import { useLiveEvent } from "../realtime/socket";
import { AssignDriver } from "./AssignDriver";
import { Badge } from "./Badge";
import { Confirm, PendingConfirm } from "./Confirm";
import { Drawer } from "./Overlay";
import { useAction, useToast } from "./Toast";

// everything about one order, with the admin override buttons
export const OrderDrawer = ({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const run = useAction();
  const toast = useToast();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [assigning, setAssigning] = useState(false);

  const { data: order, error, reload } = useAsync(
    () => api.get<{ order: OrderDetail }>(`/api/admin/orders/${orderId}`).then((r) => r.order),
    [orderId]
  );

  // keep the panel fresh while it is open
  const onLive = useCallback(
    (e: { orderId: string }) => {
      if (e.orderId === orderId) void reload();
    },
    [orderId, reload]
  );
  useLiveEvent("admin:order", onLive);
  useLiveEvent("admin:delivery", onLive);

  const after = async () => {
    await reload();
    onChanged();
  };

  const cancelOrder = () =>
    setConfirm({
      title: `Cancel order ${order?.orderNumber}?`,
      message: "Every item that has not been picked up is cancelled and the stock goes back to the stores. The customer gets a text.",
      confirmLabel: "Cancel order",
      danger: true,
      run: async () => (await run(() => api.post(`/api/admin/orders/${orderId}/cancel`), "Order cancelled")) && after(),
    });

  const setItem = (itemId: string, status: "CONFIRMED" | "CANCELLED", name: string) =>
    setConfirm({
      title: status === "CONFIRMED" ? `Confirm ${name}?` : `Cancel ${name}?`,
      message:
        status === "CONFIRMED"
          ? "Confirm this item for the store. When every item is confirmed, a driver is sent."
          : "This item is cancelled and its stock goes back to the store.",
      confirmLabel: status === "CONFIRMED" ? "Confirm item" : "Cancel item",
      danger: status === "CANCELLED",
      run: async () =>
        (await run(() => api.patch(`/api/admin/order-items/${itemId}/status`, { status }), "Item updated")) && after(),
    });

  const autoAssign = async (deliveryId: string) => {
    try {
      const result = await api.post<{ assigned: boolean }>(`/api/admin/deliveries/${deliveryId}/auto-assign`);
      toast(result.assigned ? "Driver found and assigned" : "No free driver in this department right now", !result.assigned);
      await after();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", true);
    }
  };

  return (
    <Drawer onClose={onClose}>
      {error && <div className="error-text">{error}</div>}
      {!order ? (
        <div className="muted">Loading…</div>
      ) : (
        <>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <h1 className="mono">{order.orderNumber}</h1>
              <div className="small muted">{dateTime(order.createdAt)}</div>
            </div>
            <button className="btn" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            <Badge status={order.status} />
            <Badge status={order.paymentStatus} label={`Payment: ${humanize(order.paymentStatus)}`} />
          </div>

          <dl className="kv">
            <dt>Customer</dt>
            <dd>
              {order.customer.name} · <span className="mono">{order.customer.phone}</span>
            </dd>
            <dt>Deliver to</dt>
            <dd>
              {order.deliveryAddress}, {order.deliveryCity}, {order.deliveryDepartment}
              {order.deliveryNotes && <div className="small muted">“{order.deliveryNotes}”</div>}
            </dd>
            <dt>Payment</dt>
            <dd>{humanize(order.paymentMethod)}</dd>
            <dt>Subtotal</dt>
            <dd className="mono">{money(order.subtotal)}</dd>
            <dt>Delivery fee</dt>
            <dd className="mono">{money(order.deliveryFee)}</dd>
            <dt>Total</dt>
            <dd className="mono" style={{ fontWeight: 700 }}>
              {money(order.total)}
            </dd>
          </dl>

          <div className="section">
            <h2>Items</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {item.quantity} × {item.productName}
                        </div>
                        <div className="small muted">
                          {item.vendor.storeName} · fee {money(item.commissionAmount)}
                        </div>
                      </td>
                      <td className="num">{money(item.lineTotal)}</td>
                      <td>
                        <Badge status={item.status} />
                      </td>
                      <td className="num">
                        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                          {item.status === "PENDING" && (
                            <button className="btn sm good" onClick={() => setItem(item.id, "CONFIRMED", item.productName)}>
                              Confirm
                            </button>
                          )}
                          {(item.status === "PENDING" || item.status === "CONFIRMED") && (
                            <button className="btn sm danger" onClick={() => setItem(item.id, "CANCELLED", item.productName)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <h2>Delivery</h2>
            {!order.delivery ? (
              <p className="muted small">
                No delivery yet. A driver is sent once every store has confirmed its items.
              </p>
            ) : (
              <>
                <dl className="kv">
                  <dt>Status</dt>
                  <dd>
                    <Badge status={order.delivery.status} />
                  </dd>
                  <dt>Driver</dt>
                  <dd>
                    {order.delivery.driver ? (
                      <>
                        {order.delivery.driver.user.name} ·{" "}
                        <span className="mono">{order.delivery.driver.user.phone}</span>
                      </>
                    ) : (
                      <span className="muted">None yet</span>
                    )}
                  </dd>
                  {order.delivery.failReason && (
                    <>
                      <dt>Problem</dt>
                      <dd>{order.delivery.failReason}</dd>
                    </>
                  )}
                  <dt>Assigned</dt>
                  <dd>{dateTime(order.delivery.assignedAt)}</dd>
                  <dt>Picked up</dt>
                  <dd>{dateTime(order.delivery.pickedUpAt)}</dd>
                  <dt>Delivered</dt>
                  <dd>{dateTime(order.delivery.deliveredAt)}</dd>
                </dl>
                {["WAITING_FOR_DRIVER", "ASSIGNED", "FAILED"].includes(order.delivery.status) && (
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn" onClick={() => setAssigning(true)}>
                      {order.delivery.driver ? "Change driver" : "Assign driver"}
                    </button>
                    {order.delivery.status === "WAITING_FOR_DRIVER" && (
                      <button
                        className="btn"
                        onClick={() => void autoAssign(order.delivery!.id)}
                      >
                        Find a driver now
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {(order.status === "PENDING" || order.status === "CONFIRMED") && (
            <div className="section">
              <button className="btn danger" onClick={cancelOrder}>
                Cancel whole order
              </button>
            </div>
          )}

          {assigning && order.delivery && (
            <AssignDriver
              deliveryId={order.delivery.id}
              department={order.deliveryDepartment}
              onDone={after}
              onClose={() => setAssigning(false)}
            />
          )}
          {confirm && <Confirm {...confirm} onConfirm={confirm.run} onClose={() => setConfirm(null)} />}
        </>
      )}
    </Drawer>
  );
};
