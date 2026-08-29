# Aynix

A Haiti-focused e-commerce marketplace, built as a modular monolith designed to grow into a full microservice architecture over time. Customers browse and order from local vendors, vendors manage their own stores and inventory, and the platform earns through commissions and premium vendor plans.

This is a learning project as much as a product. Every module follows the same clean structure on purpose, so the codebase stays easy to reason about as it grows.

## Status

Actively in early development. Not launched. Core authentication is complete and tested. The vendor module is built and awaiting testing. Product and order modules are next.

## Tech stack

- **Runtime:** Node.js 24 (LTS)
- **Language:** TypeScript
- **Web framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Prisma 7
- **Auth:** JWT (jsonwebtoken) + bcrypt for password hashing
- **Version control:** Git / GitHub

## Architecture

Aynix is built as a **modular monolith**. All code runs as a single deployable app, but it's internally organized into self-contained modules that mirror what will eventually become independent microservices (users, vendors, products, orders, delivery, payments, notifications). Each module owns its own routes, controllers, services, and repositories, and modules don't reach into each other's internals directly.

This means the project is fast to build and run today, but structured so pieces can be split out into real services later without a rewrite.

```
src/
  modules/
    user/         → registration, login, profile (auth complete)
    vendor/       → store creation, vendor profile (built, untested)
    market/        → products, categories (planned)
    order/         → cart, order lifecycle (planned)
    delivery/       → driver assignment, tracking (planned)
    payment/        → MonCash, NatCash, commissions (planned)
    notification/    → SMS, push, order updates (planned)
  shared/
    database/       → Prisma client connection
    middleware/     → auth guard (JWT verification)
    events/         → in-process event bus (planned)
  config/
  app.ts            → app entry point, wires modules together
prisma/
  schema.prisma      → database schema (Prisma models)
```

Each module follows the same four-file pattern:

| File | Responsibility |
|---|---|
| `*.routes.ts` | Defines the module's URL endpoints |
| `*.controller.ts` | Handles incoming requests, calls the service, shapes the response |
| `*.service.ts` | Business logic, validation rules |
| `*.repository.ts` | The only layer that talks to the database |

## Features built so far

**User module**
- Registration with bcrypt password hashing
- Login with JWT token issuance (7-day expiry)
- Protected `/me` profile route guarded by auth middleware
- Vague, non-revealing error messages on failed login (security best practice)

**Vendor module**
- Store creation linked 1:1 to a user account
- Automatic slug generation from store name (e.g. "Ti Jan Shop" → `ti-jan-shop`)
- Slug collision handling
- One store per user, enforced at the service layer
- Store status lifecycle: `PENDING → ACTIVE / SUSPENDED / REJECTED`

**Shared infrastructure**
- Central Prisma client connection (`shared/database/prisma.ts`)
- `requireAuth` middleware that verifies JWTs and attaches the authenticated user to the request

## Database

PostgreSQL, managed through Prisma. Current models:

- `User` — accounts for customers, vendors, and admins (role-based)
- `Vendor` — store profiles, linked 1:1 to a `User`

Planned: `Product`, `Category`, `Order`, `OrderItem`, `Commission`, `Payment`, `Warehouse`, `Shipment` — full schema already designed, to be added incrementally as each module is built.

## Getting started (local development)

**Requirements**
- Node.js 24+ (managed via `nvm`)
- PostgreSQL 14+
- npm

**Setup**

```bash
git clone https://github.com/LordwXdev/aynix.git
cd aynix
npm install
```

Create a `.env` file in the project root:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/aynix?schema=public"
JWT_SECRET="your_own_long_random_secret"
```

Push the schema to your database and generate the Prisma client:

```bash
npx prisma db push
npx prisma generate
```

Run the dev server:

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## API endpoints (current)

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/api/users/register` | No | Create a new account |
| POST | `/api/users/login` | No | Log in, receive a JWT |
| GET | `/api/users/me` | Yes | Get your own profile |
| POST | `/api/vendors` | Yes | Create a store for your account |
| GET | `/api/vendors/me` | Yes | Get your own store |

Protected routes require an `Authorization: Bearer <token>` header.

## Roadmap

- [x] User registration & login (JWT + bcrypt)
- [x] Auth middleware
- [x] Vendor store creation
- [ ] Product module (create, list, search)
- [ ] Order module (cart, checkout, order lifecycle)
- [ ] Commission calculation on completed orders
- [ ] Payment integration (cash on delivery first, MonCash/NatCash later)
- [ ] Vendor plans / premium tiers
- [ ] Logistics network (warehouses, delivery zones, shipment tracking) — phase 2

## Why this structure

The long-term vision is a full Amazon-style distributed system: separate services, an event bus, real-time tracking, a logistics network across Haiti's departments. But that architecture is something a company *grows into* through real usage, not something one builds alone before a single user exists. This project is deliberately built as a clean, modular first version that can evolve into that system piece by piece, without ever needing to be thrown away and rewritten.

## Author

Built by [Lord](https://github.com/LordwXdev), CSIE student, as a learning project and the foundation for a real Haitian marketplace.
