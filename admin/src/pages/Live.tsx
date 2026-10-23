import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { api } from "../api/client";
import type { DeliveryRow, Driver, Paged } from "../api/types";
import { humanize, timeAgo } from "../lib/format";
import { useLiveEvent, useRealtime } from "../realtime/socket";

// the middle of Haiti, zoomed out enough to see every department
const HAITI: [number, number] = [18.95, -72.6];

interface FeedItem {
  id: number;
  at: Date;
  text: string;
}

interface DeliveryEvent {
  orderNumber: string;
  status: string;
}
interface OrderEvent {
  orderNumber: string;
  status: string;
}
interface LocationEvent {
  driverId: string;
  lat: number;
  lng: number;
}

// zoom to fit the drivers the first time we have some
const FitOnce = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done || points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    setDone(true);
  }, [points, done, map]);
  return null;
};

export const Live = () => {
  const { connected } = useRealtime();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [busy, setBusy] = useState<Map<string, string>>(new Map()); // driverId -> order number
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const load = useCallback(async () => {
    const [online, assigned, pickedUp] = await Promise.all([
      api.get<Paged<Driver>>("/api/admin/drivers", { status: "ACTIVE", online: true, limit: 100 }),
      api.get<Paged<DeliveryRow>>("/api/admin/deliveries", { status: "ASSIGNED", limit: 100 }),
      api.get<Paged<DeliveryRow>>("/api/admin/deliveries", { status: "PICKED_UP", limit: 100 }),
    ]);
    setDrivers(online.items);
    const jobs = new Map<string, string>();
    for (const d of [...assigned.items, ...pickedUp.items]) {
      if (d.driver) jobs.set(d.driver.id, `${d.order.orderNumber} · ${humanize(d.status)}`);
    }
    setBusy(jobs);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const push = (text: string) =>
    setFeed((f) => [{ id: Date.now() + Math.random(), at: new Date(), text }, ...f].slice(0, 100));

  // a driver moved: move their dot without reloading everything
  const onLocation = useCallback((e: LocationEvent) => {
    setDrivers((list) =>
      list.map((d) =>
        d.id === e.driverId
          ? { ...d, latitude: e.lat, longitude: e.lng, lastSeenAt: new Date().toISOString() }
          : d
      )
    );
  }, []);

  const onDelivery = useCallback(
    (e: DeliveryEvent) => {
      push(`Delivery ${e.orderNumber}: ${humanize(e.status)}`);
      void load();
    },
    [load]
  );

  const onOrder = useCallback((e: OrderEvent) => {
    push(e.status === "PENDING" ? `New order ${e.orderNumber}` : `Order ${e.orderNumber}: ${humanize(e.status)}`);
  }, []);

  useLiveEvent("admin:driver_location", onLocation);
  useLiveEvent("admin:delivery", onDelivery);
  useLiveEvent("admin:order", onOrder);

  const placed = drivers.filter((d) => d.latitude !== null && d.longitude !== null);
  const points = useMemo(
    () => placed.map((d) => [d.latitude!, d.longitude!] as [number, number]),
    // only the count matters for the first fit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed.length]
  );

  return (
    <>
      <div className="page-head">
        <h1>Live map</h1>
        <div className="small muted">
          <span className={`live-dot${connected ? " on" : ""}`} />
          {drivers.length} driver{drivers.length === 1 ? "" : "s"} online · {busy.size} on a job
          {drivers.length > placed.length && ` · ${drivers.length - placed.length} without GPS`}
        </div>
      </div>
      <div className="live-grid">
        <div>
          <div className="map">
            <MapContainer center={HAITI} zoom={8} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitOnce points={points} />
              {placed.map((d) => {
                const job = busy.get(d.id);
                return (
                  <CircleMarker
                    key={d.id}
                    center={[d.latitude!, d.longitude!]}
                    radius={8}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: job ? "#2a78d6" : "#0ca30c",
                      fillOpacity: 1,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      <strong>{d.user.name}</strong> · {humanize(d.vehicleType)}
                      <br />
                      {job ? `On job ${job}` : "Free"} · seen {timeAgo(d.lastSeenAt)}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div className="btn-row small muted" style={{ marginTop: 8, gap: 16 }}>
            <span>
              <span className="live-dot" style={{ background: "#0ca30c" }} />
              Free driver
            </span>
            <span>
              <span className="live-dot" style={{ background: "#2a78d6" }} />
              Driver on a job
            </span>
          </div>
        </div>
        <div className="card feed">
          <h2>What is happening</h2>
          {feed.length === 0 ? (
            <div className="muted small">
              New orders and delivery updates show up here as they happen.
            </div>
          ) : (
            feed.map((f) => (
              <div key={f.id} className="feed-item">
                <div>{f.text}</div>
                <div className="feed-time">{f.at.toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
