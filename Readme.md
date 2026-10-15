# Aynix

A Haiti-focused e-commerce marketplace, built as a modular monolith designed to grow into a full microservice architecture over time. Customers browse and order from local vendors, vendors manage their own stores and inventory, drivers (Aynix Move) deliver the orders, and the platform earns through commissions and premium vendor plans.

This is a learning project as much as a product. Every module follows the same clean structure on purpose, so the codebase stays easy to reason about as it grows.

## Status

Backend core is complete and tested end to end. A full order goes from checkout, to vendor confirmation, to automatic driver assignment, to live GPS tracking, to delivery and cash payment, with notifications and live updates at every step.

The web admin panel is built too (`admin/`): dashboard, live driver map, and every admin action from the API.

The mobile app is built too (`mobile/`): one Expo app where customers shop, sellers run their store and drivers deliver.

## Tech stack

- **Runtime:** Node.js 22+ (24 LTS recommended)
- **Language:** TypeScript
- **Web framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Prisma 7
- **Auth:** JWT access tokens + rotating refresh tokens, bcrypt for passwords
- **Real-time:** Socket.io
- **Security:** helmet, CORS, rate limiting
- **Version control:** Git / GitHub

## Architecture

Aynix is built as a **modular monolith**. All code runs as a single deployable app, but it's internally organized into self-contained modules that mirror what will eventually become independent microservices. Each module owns its own routes, controllers, services, and repositories, and modules don't reach into each other's internals directly.

Modules talk in two ways:

1. **Direct calls** to another module's service, when the answer is needed right now (for example, the order service asks the vendor service "which store does this user own?").
2. **Events**, when something happened and others may want to react. The module that emits doesn't know who is listening. This is the in-process version of the Kafka / RabbitMQ event system planned for later.

```
Order placed ──► event "order.placed"
                   ├─► Notification: tell the customer, text the vendor
                   └─► Realtime: show it live on the admin panel

Vendor confirms ──► event "order.status_changed" (CONFIRMED)
                   ├─► Delivery: create the delivery, pick the nearest free driver
                   ├─► Notification: tell the customer
                   └─► Realtime: push the update to everyone watching the order
```

```
src/
  config/
    env.ts            → all settings in one place, app stops early if one is missing
  modules/
    user/             → sign up, login, refresh tokens, profile
    vendor/           → store creation, store page, store approval
    market/           → products, categories, search
    order/            → checkout, order lifecycle, vendor sales
    delivery/         → Aynix Move: drivers, deliveries, driver matching
    notification/     → in-app notifications + SMS
    realtime/         → Socket.io gateway (live updates, live GPS)
    admin/            → control center: users, stores, drivers, orders, analytics
  shared/
    database/         → Prisma client connection
    middleware/       → auth guard (JWT) and role guard
    events/           → in-process event bus
    realtime/         → the hub any module uses to push live messages
    sms/              → SMS provider (console for now)
    errors.ts         → clean error responses
  app.ts              → app entry point, wires modules together
admin/                → web admin panel (React), see admin/README.md
mobile/               → mobile app (Expo / React Native), see mobile/README.md
prisma/
  schema.prisma       → database schema
  seed.ts             → first admin + starter categories
scripts/
  smoke.ts            → end-to-end test of the whole flow
```

Each module follows the same four-file pattern:

| File | Responsibility |
|---|---|
| `*.routes.ts` | Defines the module's URL endpoints |
| `*.controller.ts` | Handles incoming requests, calls the service, shapes the response |
| `*.service.ts` | Business logic, validation rules |
| `*.repository.ts` | The only layer that talks to the database |

Modules that react to events also have a `*.listeners.ts` file.

## How an order flows

```
Customer places order          order PENDING        stock is taken
        │
Each store confirms its items  order CONFIRMED      (every store must confirm)
        │
Delivery created               WAITING_FOR_DRIVER
        │  nearest free, online driver in the same department
Driver assigned                ASSIGNED             driver can decline → next driver
        │
Driver picks up                PICKED_UP            order SHIPPED
        │  GPS streams live to the customer's map
Driver delivers                DELIVERED            order DELIVERED, cash PAID
```

- A store can cancel its items before pickup. Stock goes back automatically.
- A customer can cancel the whole order before pickup.
- If no driver is free, the job waits. We try again every minute and every time a driver goes online.
- If the drop-off fails, the delivery is marked FAILED and the admin can assign it again.
- Money is calculated in cents. The commission (10% by default) and the vendor payout are saved on every order line.

## Roles

| Role | How you get it |
|---|---|
| `CUSTOMER` | Everyone starts here |
| `VENDOR` | Open a store (`POST /api/vendors`). The store must be approved by an admin before products show up |
| `DRIVER` | Apply (`POST /api/drivers`). An admin must approve before you can go online |
| `ADMIN` | Created by `npm run seed` |

After opening a store or applying as a driver, call `/api/users/refresh` to get a token with the new role.

## Database

PostgreSQL, managed through Prisma. Models:

- `User` — accounts with a role
- `RefreshToken` — one per logged-in device (only a hash is stored)
- `Vendor` — store profiles with location, linked 1:1 to a `User`
- `Category`, `Product`
- `Order`, `OrderItem` — with commission and payout per line
- `Driver` — vehicle, department, online status, last GPS position
- `Delivery` — one per order, with its driver and timeline
- `Notification` — in-app notifications

## Getting started (local development)

**Requirements**
- Node.js 22+
- PostgreSQL 14+
- npm

**Setup**

```bash
git clone https://github.com/LordwXdev/aynix.git
cd aynix
npm install
cp .env.example .env     # then fill it in
```

Push the schema, generate the Prisma client, and seed the admin + categories:

```bash
npm run db:push
npm run db:generate
npm run seed
```

Run the dev server:

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

**Run the admin panel** (in a second terminal):

```bash
npm run admin:install   # first time only
npm run admin
```

Open http://localhost:5173 and log in with your `ADMIN_PHONE` and `ADMIN_PASSWORD`.

**Run the mobile app** (needs the Expo Go app on your phone, same Wi-Fi as your computer):

```bash
cd mobile
npm install
npx expo start          # scan the QR code with your phone
```

See `mobile/README.md` for details.

**Test the whole flow** (with the server running):

```bash
npm run smoke
```

## API endpoints

Protected routes need an `Authorization: Bearer <accessToken>` header.

**Users** `/api/users`

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/register` | Public | Create an account, get tokens |
| POST | `/login` | Public | Log in, get `accessToken` (15 min) + `refreshToken` (30 days) |
| POST | `/refresh` | Public | Swap a refresh token for a new pair |
| POST | `/logout` | Public | End this device's session |
| POST | `/logout-all` | Logged in | End every session |
| GET / PATCH | `/me` | Logged in | See or edit your profile |

**Stores** `/api/vendors`

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/` | Logged in | Open a store (becomes VENDOR) |
| GET / PATCH | `/me` | Vendor | See or edit your store |
| GET | `/:slug` | Public | Store page with its products |

**Products** `/api/products` and `/api/categories`

| Method | Endpoint | Who | Description |
|---|---|---|---|
| GET | `/api/products?q=&categoryId=&page=&limit=` | Public | Browse and search |
| GET | `/api/products/:id` | Public | One product |
| GET | `/api/products/mine` | Vendor | All my products |
| POST | `/api/products` | Vendor | Add a product |
| PATCH | `/api/products/:id` | Vendor | Edit my product |
| GET | `/api/categories` | Public | Active categories |

**Orders** `/api/orders`

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/` | Customer | Place an order (cash on delivery) |
| GET | `/` | Customer | My orders |
| GET | `/:id` | Customer | One order |
| GET | `/:id/tracking` | Customer | Delivery status, driver and position |
| POST | `/:id/cancel` | Customer | Cancel before pickup |
| GET | `/vendor/items?status=` | Vendor | Items bought from my store |
| GET | `/vendor/sales` | Vendor | Sales, commission, payout |
| PATCH | `/items/:itemId/status` | Vendor | `CONFIRMED` or `CANCELLED` |

**Drivers and deliveries** `/api/drivers`, `/api/deliveries`

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/api/drivers` | Logged in | Apply to drive |
| GET | `/api/drivers/me` | Driver | My driver profile |
| PATCH | `/api/drivers/me/online` | Driver | `{ isOnline: true/false }` |
| POST | `/api/drivers/me/location` | Driver | `{ latitude, longitude }` |
| GET | `/api/deliveries/mine?active=true` | Driver | My jobs, with pickup and drop-off details |
| POST | `/api/deliveries/:id/decline` | Driver | Say no to a job |
| POST | `/api/deliveries/:id/pickup` | Driver | Got the goods |
| POST | `/api/deliveries/:id/deliver` | Driver | Handed over, cash collected |
| POST | `/api/deliveries/:id/fail` | Driver | `{ reason }` could not deliver |

**Notifications** `/api/notifications`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/?page=&limit=` | My notifications + unread count |
| PATCH | `/:id/read` | Mark one as read |
| POST | `/read-all` | Mark all as read |

**Admin control center** `/api/admin` (admins only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Counts, money, today, last 30 days, top stores |
| GET | `/users?role=&q=` | Find users |
| PATCH | `/users/:id/active` | `{ isActive: false }` bans and logs out |
| GET | `/vendors?status=` | Stores |
| PATCH | `/vendors/:id/status` | Approve, suspend, reject |
| GET | `/drivers?status=&online=` | Drivers |
| PATCH | `/drivers/:id/status` | Approve, suspend, reject |
| GET | `/orders?status=&q=` | Orders |
| GET | `/orders/:id` | Full order with items and delivery |
| POST | `/orders/:id/cancel` | Cancel an order |
| PATCH | `/order-items/:itemId/status` | Confirm or cancel one item |
| GET | `/deliveries?status=` | Deliveries |
| POST | `/deliveries/:id/assign` | `{ driverId }` pick a driver by hand (also retries failed ones) |
| POST | `/deliveries/:id/auto-assign` | Run the matching again now |
| GET / POST / PATCH | `/categories` | Manage categories |

## Real-time (Socket.io)

Connect on the same URL as the API:

```js
const socket = io("http://localhost:3000", { auth: { token: accessToken } });
```

Every user automatically joins their own room. Admins also join the admin room.

| Direction | Event | Data |
|---|---|---|
| send | `order:watch` | `{ orderId }` start following an order (with ack) |
| send | `order:unwatch` | `{ orderId }` |
| send (driver) | `driver:location` | `{ latitude, longitude }` (with ack) |
| receive | `notification` | a new notification |
| receive | `order:update` | `{ orderId, status, ... }` |
| receive | `order:item_update` | one store confirmed or cancelled |
| receive | `delivery:update` | `{ orderId, status, ... }` |
| receive | `delivery:location` | `{ orderId, lat, lng }` driver moved |
| receive (admin) | `admin:order`, `admin:delivery`, `admin:driver_location` | everything, live |

## Roadmap

- [x] User registration & login (JWT + bcrypt)
- [x] Access + refresh tokens, logout, theft detection
- [x] Role-based access (customer, vendor, driver, admin)
- [x] Vendor store creation and approval
- [x] Product module (create, list, search)
- [x] Order module (checkout, order lifecycle, cancel)
- [x] Commission calculation on every order line
- [x] Cash on delivery
- [x] Delivery service (Aynix Move): drivers, auto-assignment, tracking
- [x] Event-driven modules (in-process event bus)
- [x] Notifications (in-app + SMS hook)
- [x] Real-time updates and live GPS (Socket.io)
- [x] Admin control center API with analytics
- [x] Web admin panel (React)
- [x] Mobile app (React Native: customer, vendor, driver views)
- [ ] Image uploads (S3 / Cloudinary)
- [ ] Real SMS provider and push notifications
- [ ] MonCash / NatCash payments, vendor payouts, driver earnings
- [ ] Vendor plans / premium tiers
- [ ] Delivery fees by distance
- [ ] Redis caching, Kafka / RabbitMQ events, split into services
- [ ] Logistics network (hubs, warehouses, delivery zones) — phase 2

## Why this structure

The long-term vision is a full Amazon-style distributed system: separate services, an event bus, real-time tracking, a logistics network across Haiti's departments. But that architecture is something a company *grows into* through real usage, not something one builds alone before a single user exists. This project is deliberately built as a clean, modular first version that can evolve into that system piece by piece, without ever needing to be thrown away and rewritten.

## Author

Built by [Lord](https://github.com/LordwXdev), CSIE student at Tamkang University(Taiwan), as a learning project and the foundation for a real Haitian marketplace.
