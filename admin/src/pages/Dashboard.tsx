import { useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Dashboard as DashboardData } from "../api/types";
import { ColumnChart } from "../components/ColumnChart";
import { useAsync } from "../lib/useAsync";
import { compact, count, money, shortDate } from "../lib/format";
import { useLiveEvent } from "../realtime/socket";

const sum = (record: Record<string, number> | undefined) =>
  Object.entries(record ?? {}).reduce((total, [key, n]) => (key === "online" ? total : total + n), 0);

// the API only returns days that had orders, so we fill the empty days with 0
const fillDays = (rows: DashboardData["last30Days"]) => {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r]));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    days.push({
      label: shortDate(d),
      orders: row?.orders ?? 0,
      sales: Number(row?.sales ?? 0),
    });
  }
  return days;
};

const Tile = ({ label, value, sub, to }: { label: string; value: string; sub?: string; to?: string }) => {
  const body = (
    <>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="card" style={{ color: "inherit" }}>
      {body}
    </Link>
  ) : (
    <div className="card">{body}</div>
  );
};

export const Dashboard = () => {
  const { data, error, reload } = useAsync(() => api.get<DashboardData>("/api/admin/dashboard"), []);

  // new orders and deliveries change the numbers: reload, at most every few seconds
  const timer = useRef<number | null>(null);
  const refreshSoon = useCallback(() => {
    if (timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void reload();
    }, 3000);
  }, [reload]);
  useLiveEvent("admin:order", refreshSoon);
  useLiveEvent("admin:delivery", refreshSoon);

  const days = useMemo(() => (data ? fillDays(data.last30Days) : []), [data]);

  if (error) return <div className="card error-text">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  const pendingStores = data.vendors.PENDING ?? 0;
  const pendingDrivers = data.drivers.PENDING ?? 0;
  const waiting = data.deliveries.WAITING_FOR_DRIVER ?? 0;
  const failed = data.deliveries.FAILED ?? 0;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <button className="btn" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <div className="grid tiles">
        <Tile label="Orders today" value={count(data.today.orders)} sub={money(data.today.sales)} to="/orders" />
        <Tile label="Commission earned" value={money(data.money.commissionEarned)} sub="from delivered orders" />
        <Tile label="Delivered sales" value={money(data.money.deliveredSales)} sub={`${money(data.money.owedToVendors)} owed to stores`} />
        <Tile label="Drivers online" value={count(data.drivers.online)} sub={`${count(data.drivers.ACTIVE)} approved`} to="/live" />
      </div>

      <div className="grid tiles">
        <Tile label="Need a driver" value={count(waiting)} sub={failed ? `${failed} failed` : "deliveries waiting"} to="/deliveries" />
        <Tile label="Stores to approve" value={count(pendingStores)} sub={`${count(data.vendors.ACTIVE)} active stores`} to="/stores" />
        <Tile label="Drivers to approve" value={count(pendingDrivers)} sub={`${count(sum(data.drivers))} drivers total`} to="/drivers" />
        <Tile label="Users" value={count(sum(data.users))} sub={`${count(data.users.CUSTOMER)} customers`} to="/users" />
      </div>

      <div className="grid two">
        <ColumnChart
          title="Orders per day"
          points={days.map((d) => ({ label: d.label, value: d.orders }))}
          format={(n) => `${count(n)} orders`}
          axisFormat={(n) => compact(n)}
        />
        <ColumnChart
          title="Sales per day"
          points={days.map((d) => ({ label: d.label, value: d.sales }))}
          format={money}
          axisFormat={(n) => compact(n)}
        />
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Orders by status</h2>
          <table>
            <tbody>
              {["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => (
                <tr key={s}>
                  <td>
                    <Link to={`/orders?status=${s}`}>{s.charAt(0) + s.slice(1).toLowerCase()}</Link>
                  </td>
                  <td className="num">{count(data.orders[s])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Top stores</h2>
          {data.topVendors.length === 0 ? (
            <div className="empty">No delivered sales yet</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th className="num">Sales</th>
                  <th className="num">Commission</th>
                </tr>
              </thead>
              <tbody>
                {data.topVendors.map((v, i) => (
                  <tr key={v.vendor?.id ?? i}>
                    <td>{v.vendor?.storeName ?? "Deleted store"}</td>
                    <td className="num">{money(v.sales)}</td>
                    <td className="num">{money(v.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};
