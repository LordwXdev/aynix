// end-to-end check of the whole flow against a running server
//   1. start the server:  npm run dev
//   2. seed an admin:     npm run seed   (needs ADMIN_PHONE / ADMIN_PASSWORD)
//   3. run this:          npm run smoke
// it creates its own test users each time, so it is safe to run again
import "dotenv/config";
import assert from "node:assert/strict";
import { io, Socket } from "socket.io-client";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const run = Date.now().toString().slice(-7);
// each run gets its own department so drivers from older runs never take its jobs
const DEPARTMENT = `Test-${run}`;

type Json = Record<string, any>;

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
};

// call and insist on a status code
const expect = async (status: number, method: string, path: string, token?: string, body?: unknown) => {
  const res = await call(method, path, token, body);
  assert.equal(res.status, status, `${method} ${path} -> ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// wait until a condition is true (events are handled a moment after the request)
const until = async (what: string, check: () => Promise<boolean>) => {
  for (let i = 0; i < 40; i++) {
    if (await check()) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for: ${what}`);
};

const step = (text: string) => console.log(`✔ ${text}`);

const register = async (name: string, phone: string) => {
  const data = await expect(201, "POST", "/api/users/register", undefined, {
    name,
    phone,
    password: "password-123",
  });
  return { access: data.accessToken as string, refresh: data.refreshToken as string, id: data.user.id as string };
};

const connect = (token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });

const main = async () => {
  await expect(200, "GET", "/health");

  // --- people ---
  const admin = await expect(200, "POST", "/api/users/login", undefined, {
    phone: process.env.ADMIN_PHONE,
    password: process.env.ADMIN_PASSWORD,
  });
  const adminToken = admin.accessToken as string;

  const customer = await register("Marie Customer", `+509100${run}`);
  const seller = await register("Jean Seller", `+509200${run}`);
  const rider = await register("Paul Driver", `+509300${run}`);
  step("registered customer, seller, driver and logged in admin");

  // --- refresh tokens ---
  const rotated = await expect(200, "POST", "/api/users/refresh", undefined, { refreshToken: customer.refresh });
  // using the old token again looks like theft: everything gets logged out
  await expect(401, "POST", "/api/users/refresh", undefined, { refreshToken: customer.refresh });
  await expect(401, "POST", "/api/users/refresh", undefined, { refreshToken: rotated.refreshToken });
  const relogin = await expect(200, "POST", "/api/users/login", undefined, {
    phone: `+509100${run}`,
    password: "password-123",
  });
  customer.access = relogin.accessToken;
  step("refresh token rotates, and reuse logs the user out everywhere");

  // --- vendor ---
  await expect(403, "POST", "/api/products", seller.access, {});
  const store = await expect(201, "POST", "/api/vendors", seller.access, {
    storeName: `Ti Jan Shop ${run}`,
    city: "Port-au-Prince",
    department: DEPARTMENT,
    latitude: 18.5392,
    longitude: -72.335,
  });
  const sellerTokens = await expect(200, "POST", "/api/users/refresh", undefined, { refreshToken: seller.refresh });
  seller.access = sellerTokens.accessToken;

  const { categories } = await expect(200, "GET", "/api/categories");
  assert.ok(categories.length > 0, "run npm run seed first");

  const { product } = await expect(201, "POST", "/api/products", seller.access, {
    name: `Diri Lokal ${run}`,
    price: 250,
    stockQty: 10,
    categoryId: categories[0].id,
    status: "ACTIVE",
  });
  await expect(404, "GET", `/api/products/${product.id}`);
  step("store opened, role became VENDOR, product hidden until store is approved");

  await expect(403, "GET", "/api/admin/dashboard", customer.access);
  await expect(200, "PATCH", `/api/admin/vendors/${store.vendor.id}/status`, adminToken, { status: "ACTIVE" });
  await expect(200, "GET", `/api/products/${product.id}`);
  await expect(200, "GET", `/api/vendors/${store.vendor.storeSlug}`);
  step("admin approved the store, product and store page are public");

  // --- driver ---
  const applied = await expect(201, "POST", "/api/drivers", rider.access, {
    vehicleType: "MOTO",
    plateNumber: "AA-12345",
    city: "Port-au-Prince",
    department: DEPARTMENT.toLowerCase(),
  });
  const riderTokens = await expect(200, "POST", "/api/users/refresh", undefined, { refreshToken: rider.refresh });
  rider.access = riderTokens.accessToken;
  await expect(400, "PATCH", "/api/drivers/me/online", rider.access, { isOnline: true });
  await expect(200, "PATCH", `/api/admin/drivers/${applied.driver.id}/status`, adminToken, { status: "ACTIVE" });
  await expect(200, "PATCH", "/api/drivers/me/online", rider.access, { isOnline: true });
  await expect(200, "POST", "/api/drivers/me/location", rider.access, { latitude: 18.54, longitude: -72.34 });
  step("driver applied, approved, online with a GPS position");

  // --- order ---
  const customerSocket = await connect(customer.access);
  const adminSocket = await connect(adminToken);
  const seen: string[] = [];
  customerSocket.onAny((event) => seen.push(event));
  let adminSawDelivery = false;
  adminSocket.on("admin:delivery", () => (adminSawDelivery = true));

  const { order } = await expect(201, "POST", "/api/orders", customer.access, {
    items: [{ productId: product.id, quantity: 2 }],
    deliveryAddress: "12 Rue Capois",
    deliveryCity: "Port-au-Prince",
    deliveryDepartment: DEPARTMENT,
    deliveryLatitude: 18.545,
    deliveryLongitude: -72.338,
  });
  assert.equal(order.total, "500");
  const watch = await customerSocket.emitWithAck("order:watch", { orderId: order.id });
  assert.equal(watch.ok, true);
  step(`order ${order.orderNumber} placed and watched live`);

  // vendors cannot ship or deliver by themselves any more
  const { items } = await expect(200, "GET", "/api/orders/vendor/items?status=PENDING", seller.access);
  const item = items.find((i: Json) => i.orderId === order.id);
  await expect(400, "PATCH", `/api/orders/items/${item.id}/status`, seller.access, { status: "SHIPPED" });
  await expect(200, "PATCH", `/api/orders/items/${item.id}/status`, seller.access, { status: "CONFIRMED" });

  let job: Json | undefined;
  await until("driver gets the job", async () => {
    const { deliveries } = await expect(200, "GET", "/api/deliveries/mine?active=true", rider.access);
    job = deliveries.find((d: Json) => d.orderId === order.id);
    return job?.status === "ASSIGNED";
  });
  step("vendor confirmed, delivery created and auto-assigned to the nearest driver");

  await expect(200, "POST", `/api/deliveries/${job!.id}/pickup`, rider.access);
  const tracking = await expect(200, "GET", `/api/orders/${order.id}/tracking`, customer.access);
  assert.equal(tracking.tracking.orderStatus, "SHIPPED");
  assert.equal(tracking.tracking.delivery.driver.name, "Paul Driver");

  const ack = await (await connect(rider.access)).emitWithAck("driver:location", {
    latitude: 18.543,
    longitude: -72.337,
  });
  assert.equal(ack.ok, true);
  await until("customer sees the driver move", async () => seen.includes("delivery:location"));
  step("picked up, customer sees driver details and live GPS");

  await expect(200, "POST", `/api/deliveries/${job!.id}/deliver`, rider.access);
  const done = await expect(200, "GET", `/api/orders/${order.id}`, customer.access);
  assert.equal(done.order.status, "DELIVERED");
  assert.equal(done.order.paymentStatus, "PAID");
  await until("live order update", async () => seen.includes("order:update"));
  assert.ok(adminSawDelivery, "admin did not get live delivery events");
  step("delivered, paid (cash on delivery), live updates reached customer and admin");

  const sales = await expect(200, "GET", "/api/orders/vendor/sales", seller.access);
  assert.equal(sales.sales.delivered.unitsSold, 2);
  assert.equal(sales.sales.delivered.payout, "450");
  const notes = await expect(200, "GET", "/api/notifications", customer.access);
  assert.ok(notes.unread >= 3, "customer should have notifications");
  step("vendor sales show 450 payout after 10% commission, customer has notifications");

  // --- cancel puts stock back ---
  const second = await expect(201, "POST", "/api/orders", customer.access, {
    items: [{ productId: product.id, quantity: 3 }],
    deliveryAddress: "12 Rue Capois",
    deliveryCity: "Port-au-Prince",
    deliveryDepartment: DEPARTMENT,
  });
  let p = await expect(200, "GET", `/api/products/${product.id}`);
  assert.equal(p.product.stockQty, 5);
  await expect(200, "POST", `/api/orders/${second.order.id}/cancel`, customer.access);
  p = await expect(200, "GET", `/api/products/${product.id}`);
  assert.equal(p.product.stockQty, 8);
  step("customer cancelled an order and the stock came back");

  // --- decline, manual assign, failed delivery, retry ---
  const third = await expect(201, "POST", "/api/orders", customer.access, {
    items: [{ productId: product.id, quantity: 1 }],
    deliveryAddress: "5 Rue Pavée",
    deliveryCity: "Port-au-Prince",
    deliveryDepartment: DEPARTMENT,
  });
  const thirdItem = third.order.items[0];
  await expect(200, "PATCH", `/api/orders/items/${thirdItem.id}/status`, seller.access, { status: "CONFIRMED" });

  let job3: Json | undefined;
  await until("driver gets the third job", async () => {
    const { deliveries } = await expect(200, "GET", "/api/deliveries/mine?active=true", rider.access);
    job3 = deliveries.find((d: Json) => d.orderId === third.order.id);
    return job3?.status === "ASSIGNED";
  });

  // the only driver says no, so the job waits
  const declined = await expect(200, "POST", `/api/deliveries/${job3!.id}/decline`, rider.access);
  assert.equal(declined.delivery.status, "WAITING_FOR_DRIVER");

  // admin overrides and gives it back to them by hand
  await expect(200, "POST", `/api/admin/deliveries/${job3!.id}/assign`, adminToken, {
    driverId: applied.driver.id,
  });
  await expect(200, "POST", `/api/deliveries/${job3!.id}/pickup`, rider.access);
  await expect(400, "POST", `/api/orders/${third.order.id}/cancel`, customer.access);
  const failed = await expect(200, "POST", `/api/deliveries/${job3!.id}/fail`, rider.access, {
    reason: "Customer not home",
  });
  assert.equal(failed.delivery.status, "FAILED");

  // admin retries the failed delivery
  await expect(200, "POST", `/api/admin/deliveries/${job3!.id}/assign`, adminToken, {
    driverId: applied.driver.id,
  });
  await expect(200, "POST", `/api/deliveries/${job3!.id}/pickup`, rider.access);
  await expect(200, "POST", `/api/deliveries/${job3!.id}/deliver`, rider.access);
  const thirdDone = await expect(200, "GET", `/api/orders/${third.order.id}`, customer.access);
  assert.equal(thirdDone.order.status, "DELIVERED");
  step("driver declined, admin assigned by hand, failed delivery was retried and delivered");

  // --- admin ---
  const dash = await expect(200, "GET", "/api/admin/dashboard", adminToken);
  assert.ok(Number(dash.money.commissionEarned) >= 50);
  await expect(200, "PATCH", `/api/admin/users/${customer.id}/active`, adminToken, { isActive: false });
  await expect(401, "POST", "/api/users/login", undefined, { phone: `+509100${run}`, password: "password-123" });
  await expect(200, "PATCH", `/api/admin/users/${customer.id}/active`, adminToken, { isActive: true });
  step("admin dashboard works, ban blocks login, unban restores it");

  await expect(200, "PATCH", "/api/drivers/me/online", rider.access, { isOnline: false });
  customerSocket.close();
  adminSocket.close();
  console.log("\nAll good. The full flow works.");
  process.exit(0);
};

main().catch((err) => {
  console.error("\n✘ Smoke test failed:\n", err);
  process.exit(1);
});
