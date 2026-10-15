# Aynix production readiness: all 111 items

Where Aynix stands on each item, and where to find it in the code.

| Mark | Meaning |
|---|---|
| ✅ | **Done.** In the code and tested |
| 🔧 | **Ready.** Built in, switch it on with a setting when you need it |
| ⏳ | **Later.** Not worth it before real traffic. The "when" says when to add it |
| 📘 | **Principle.** An idea or a team habit. Says how Aynix follows it |

**Score:** 69 ✅ · 9 🔧 · 17 ⏳ · 16 📘

How it was tested: `npm run smoke` (full order flow, 15 checks), `npm run test:resilience` (6 failure checks), the mobile app driven in a browser by 3 people at once, a dropped connection during "Place order", the whole stack in Docker with **3 API servers** behind the gateway, a backup restored into a fresh database, and a clean shutdown.

---

## Traffic and APIs (1–24)

| # | Item | | In Aynix |
|---|---|---|---|
| 1 | Rate limiting | ✅ | Two layers. The gateway has a per-IP flood guard (`admin/nginx.conf`). The API limits **per user** when logged in and per phone + IP for login (`src/app.ts`). Not per IP alone, because Haitian carriers put many customers behind one IP (CGNAT). Shared between servers through Redis |
| 2 | Caching | ✅ | Categories cached in memory for 5 minutes (`category.service.ts`). `Cache-Control` on the public catalog (`src/app.ts`). Admin files cached for a year by the gateway |
| 3 | Load balancing | ✅ | NGINX `least_conn` across all API servers (`admin/nginx.conf`). Tested with 3 servers |
| 4 | Reverse proxies | ✅ | NGINX in front: gzip, security headers, timeouts, request ids, `/metrics` hidden |
| 5 | API gateways | ✅ | The same NGINX is the single entry point: routing, rate limits, auth stays in the API |
| 6 | CI/CD | ✅ | `.github/workflows/ci.yml`: type checks, builds, migrations, smoke and resilience tests, lint, then images published to GitHub's registry |
| 7 | Docker | ✅ | `Dockerfile` (multi-stage, non-root, health check), `admin/Dockerfile`, `docker-compose.yml` |
| 8 | Kubernetes | ⏳ | **When** you outgrow one server or need autoscaling. The images, health probes and graceful shutdown are already Kubernetes-ready |
| 9 | Service discovery | ✅ | Docker DNS: the gateway finds `api` and `db` by name. Kubernetes Services later |
| 10 | Circuit breakers | ✅ | Around SMS (`shared/sms/sms.ts`, `shared/utils/resilience.ts`): 5 failures, then 30 s pause. Tested |
| 11 | Timeouts | ✅ | Every layer: request 15 s, DB query 10 s, DB connect 5 s, SMS 5 s, gateway, mobile fetch 15 s |
| 12 | Retries | ✅ | Event listeners (3 tries), mobile reads and idempotent writes, gateway retries a failed GET on another server |
| 13 | Exponential backoff | ✅ | With jitter, server (`retry()`) and mobile (`lib/api.ts`). Redis reconnects too |
| 14 | Idempotency | ✅ | `Idempotency-Key` on placing and cancelling orders (`shared/middleware/idempotency.ts`). Tested with a dropped connection: one order, not two |
| 15 | Message queues | ⏳ | **When** you split services or need guaranteed delivery. Today an in-process event bus plus dead letters. Next step: BullMQ (Redis is already there) |
| 16 | Pub/Sub | ✅ | Event bus inside the app (`shared/events/event-bus.ts`). Redis pub/sub between servers for live updates |
| 17 | Event-driven architecture | ✅ | Modules react to events (`order.placed`, `delivery.assigned`…) instead of calling each other |
| 18 | Distributed transactions | 📘 | Avoided on purpose: one database, real transactions (stock + order, delivery + order status in one transaction) |
| 19 | Saga pattern | ✅ | The order → delivery flow is a saga with compensation: a cancelled order cancels its delivery and returns stock; a failed delivery can be reassigned |
| 20 | Dead letter queues | ✅ | `dead_letters` table. Failed events and texts are saved, with admin endpoints to replay or dismiss them. Tested |
| 21 | Cron jobs | ✅ | `modules/jobs/jobs.ts`: retry waiting deliveries every minute, clean old data every hour. Only one server runs each job |
| 22 | WebSockets | ✅ | Socket.io for live orders, deliveries, GPS |
| 23 | Long polling | ✅ | Automatic fallback when a network blocks websockets (mobile and admin), with sticky routing in the gateway |
| 24 | Server-Sent Events | 📘 | Not needed: Socket.io covers it both ways. SSE would fit if you ever need one-way updates without a library |

## Data (25–41)

| # | Item | | In Aynix |
|---|---|---|---|
| 25 | Database indexing | ✅ | 15 indexes for the real queries (`prisma/schema.prisma`, `@@index`) |
| 26 | Query optimization | ✅ | Only the fields needed (`select`), counts in the database, paging everywhere, dashboard in a few grouped queries |
| 27 | N+1 queries | ✅ | Related data loaded with `include` in one query. Top stores = 2 queries, not one per store |
| 28 | Connection pooling | ✅ | `pg` pool, size via `DB_POOL_MAX` (`shared/database/prisma.ts`). Add PgBouncer when you have many servers |
| 29 | Read replicas | ⏳ | **When** reads slow the main database. Point the dashboard and catalog at a replica |
| 30 | Sharding | ⏳ | **When** one Postgres can't hold the data (millions of orders per day). Natural key: department |
| 31 | Partitioning | ⏳ | **When** `orders` and `notifications` get very big: partition by month |
| 32 | Replication | 🔧 | Use a managed Postgres with a standby (Neon, RDS, Supabase). No code change |
| 33 | Leader election | ✅ | Scheduled jobs use a database lock, so one server runs them (`runIfLeader` in `shared/database/locks.ts`). Tested |
| 34 | CAP theorem | 📘 | Aynix picks **consistency** for money and stock (one Postgres, transactions) and **availability** for live updates (they can be missed, the app reloads) |
| 35 | Eventual consistency | 📘 | Notifications, live updates and dashboard numbers can lag by seconds. Stock and orders never do |
| 36 | Optimistic locking | ✅ | Status changes only apply "if it's still in the status I saw" (`updateMany where status = …`) |
| 37 | Pessimistic locking | ✅ | Driver assignment holds a database lock while choosing |
| 38 | Distributed locks | ✅ | Postgres advisory locks, shared by every server. Tested: two holders wait for each other |
| 39 | Race conditions | ✅ | Stock can't oversell, two drivers can't get the same job, a refresh token can't be used twice |
| 40 | Deadlocks | 📘 | Short transactions, always one lock, the same order of writes, 10 s query timeout as a backstop |
| 41 | Memory leaks | ✅ | Bounded caches, listeners removed when screens close, memory metric plus alert |

## Running the app (42–66)

| # | Item | | In Aynix |
|---|---|---|---|
| 42 | Garbage collection | 📘 | Node handles it. GC time is in `/metrics`. The container has a 512 MB limit |
| 43 | Thread safety | 📘 | Node runs one thread per server. Shared state lives in Postgres and Redis, guarded by locks and transactions |
| 44 | Backpressure | ✅ | Rate limits, 1 MB body limit, DB pool limit, request timeouts, socket reconnect delay |
| 45 | Autoscaling | ⏳ | **When** traffic varies a lot. On Kubernetes or a cloud runner, scale on CPU or request rate. The app is stateless, so it's ready |
| 46 | Horizontal scaling | ✅ | `docker compose up --scale api=3`. Tested: live updates, locks and rate limits work across servers |
| 47 | Vertical scaling | 📘 | Bigger server first, it's the cheapest step. Then `DB_POOL_MAX` up |
| 48 | CDN | 🔧 | Put Cloudflare in front of the gateway. `Cache-Control` headers are already set |
| 49 | Edge caching | 🔧 | Same: the catalog and admin files are marked cacheable for the edge |
| 50 | Cache invalidation | ✅ | Editing a category clears the cache. Short times (30 s products, 5 min categories) limit stale data. Admin files use hashed names |
| 51 | Feature flags | ⏳ | **When** you have users to test on. Start with env variables, later a service like Unleash |
| 52 | Blue-green deployment | 🔧 | Possible with compose: start the new stack, switch the gateway, keep the old one to switch back |
| 53 | Canary releases | ⏳ | **When** you have enough traffic for a small % to mean something. NGINX `split_clients` can send 5% to the new version |
| 54 | Rolling deployments | ✅ | Servers are replaced one by one. Each stops cleanly: "not ready", finish requests, exit. Tested |
| 55 | Rollbacks | ✅ | Every image is tagged with its commit or version. `API_TAG=… docker compose up -d`. Migrations are backward compatible (see runbook) |
| 56 | Health checks | ✅ | In Docker for each service. `/health/ready` checks the database and Redis |
| 57 | Liveness & readiness probes | ✅ | `/health/live` (restart me) and `/health/ready` (send me traffic). Readiness turns off during shutdown |
| 58 | Monitoring | ✅ | Prometheus metrics at `/metrics` (private, optional `METRICS_TOKEN`) |
| 59 | Logging | ✅ | JSON logs with pino, one line per event, secrets hidden (`shared/logger.ts`) |
| 60 | Distributed tracing | 🔧 | A request id is passed from the gateway through every log line. Add OpenTelemetry when you have several services |
| 61 | Metrics | ✅ | Latency per route, errors, memory, event loop, plus business counters (orders, deliveries, failed events) |
| 62 | Alerts | ✅ | `deploy/prometheus/alerts.yml`: errors, latency, server down, no orders, dead letters, memory |
| 63 | SLOs | ✅ | `docs/runbook.md`: 99.5% success, p99 under 1 s, orders 99% |
| 64 | SLIs | ✅ | Each SLO has its measurement in the runbook, from real metrics |
| 65 | Error budgets | ✅ | About 3.6 hours a month. Rule: over half used, stability before new features |
| 66 | Observability | ✅ | Logs + metrics + request ids + health, all tied together |

## Security (67–80)

| # | Item | | In Aynix |
|---|---|---|---|
| 67 | Secrets management | ✅ | Only in env variables, never in git. Production refuses weak or example secrets. Use your host's secret store |
| 68 | IAM | ✅ | 4 roles with guards on every route. Containers run as a non-root user. CI only gets the permissions it needs |
| 69 | OAuth | ⏳ | **When** you add "Sign in with Google" or let partners use the API. Phone + password fits Haiti today |
| 70 | JWT rotation | ✅ | Refresh tokens rotate on every use, and reuse logs the user out everywhere. Signing keys rotate with `JWT_SECRET_PREVIOUS` (runbook) |
| 71 | TLS | 🔧 | Put HTTPS in front of the gateway (Cloudflare, a cloud load balancer, or Caddy with Let's Encrypt) |
| 72 | Encryption at rest | 📘 | Use a managed Postgres with disk encryption (on by default almost everywhere). Passwords use bcrypt, refresh tokens are stored hashed |
| 73 | Encryption in transit | 🔧 | HTTPS for users (above). For the database, add `sslmode=require` to `DATABASE_URL` on a managed host |
| 74 | WAF | ⏳ | **At launch:** turn on Cloudflare's free WAF rules |
| 75 | DDoS protection | ⏳ | **At launch:** Cloudflare in front. The gateway rate limit is the second layer |
| 76 | CORS | ✅ | `CORS_ORIGINS` limits which websites may call the API |
| 77 | CSRF | ✅ | Not possible by design: tokens are sent in a header, never in cookies |
| 78 | SQL injection | ✅ | Prisma always sends values separately from the query. The few raw queries use safe template tags |
| 79 | XSS | ✅ | React escapes text. Image and logo links must be `http(s)` (blocks `javascript:`). Security headers from helmet and NGINX |
| 80 | SSRF | ✅ | The server never fetches a URL a user sends. Image links are only shown by the apps |

## Data safety and deployment (81–90)

| # | Item | | In Aynix |
|---|---|---|---|
| 81 | Database migrations | ✅ | Real migration files (`prisma/migrations`). CI checks they match the schema. Tested on a new and an existing database |
| 82 | Schema versioning | ✅ | Each migration is a dated version, tracked in `_prisma_migrations` |
| 83 | Disaster recovery | ✅ | Plan and targets in the runbook (RPO 24 h, RTO 2 h) |
| 84 | Backups | ✅ | `docker compose run --rm backup`. Tested by restoring into a fresh database |
| 85 | Failover | 🔧 | The gateway skips a dead server. Database failover comes with a managed Postgres standby |
| 86 | Multi-region deployment | ⏳ | **When** you serve outside Haiti or need to survive a whole region going down |
| 87 | Chaos engineering | ⏳ | **When** you have real traffic. Start small: stop one API server during the day and check nothing breaks |
| 88 | Cost optimization | 📘 | One small server + managed Postgres is enough to launch. Scale out only when the metrics say so |
| 89 | Cold starts | 📘 | Not serverless, so no cold starts. Startup is about a second |
| 90 | Serverless limits | 📘 | Not serverless on purpose: websockets and background jobs need a server that stays up |

## Networking and protocols (91–103)

| # | Item | | In Aynix |
|---|---|---|---|
| 91 | Latency | ✅ | Measured per route. Indexes, caching and keep-alive connections keep it low |
| 92 | Throughput | ✅ | Measured (requests per second). Scales by adding API servers |
| 93 | P99 latency | ✅ | Histogram in `/metrics`, alert above 1 s |
| 94 | Tail latency | ✅ | Timeouts cut the slowest requests. The gateway retries a failed GET on another server |
| 95 | Network partitions | 📘 | If the API can't reach the database it says "not ready" and stops getting traffic. Redis down: live updates pause, orders keep working |
| 96 | Clock skew | ✅ | JWT checks allow 30 s of difference. Order times come from the database |
| 97 | DNS | 📘 | Docker DNS inside. Use a short TTL on your domain so you can move servers quickly |
| 98 | TCP vs UDP | 📘 | Everything is TCP (HTTP, websockets, Postgres): orders must arrive complete and in order |
| 99 | HTTP/2 & HTTP/3 | 🔧 | Turned on by the TLS layer in front (Cloudflare does both) |
| 100 | gRPC | ⏳ | **When** you split into services that talk to each other a lot. Not for the mobile app |
| 101 | Webhooks | ⏳ | **With MonCash/NatCash:** receive payment confirmations, checking the signature and using idempotency (already built) |
| 102 | API versioning | ✅ | `/api/v1/...` (and `/api` as an alias). Breaking changes go to `/api/v2` |
| 103 | Semantic versioning | ✅ | `1.1.0` in `package.json`, shown in `/health`. Git tags `v1.2.0` publish images |

## Tooling and team (104–111)

| # | Item | | In Aynix |
|---|---|---|---|
| 104 | Infrastructure as Code | ✅ | `docker-compose.yml`, Dockerfiles, NGINX and alert config are all files in git |
| 105 | Terraform | ⏳ | **When** you create cloud resources (database, DNS, buckets). Describe them in Terraform instead of clicking |
| 106 | Helm charts | ⏳ | **With Kubernetes** (#8) |
| 107 | Build caching | ✅ | Docker layers ordered so `npm ci` is reused. CI caches npm and Docker layers |
| 108 | Dependency hell | ✅ | Lockfiles, `npm ci` in CI, Dependabot with Expo rules, and the rule "never `npm audit fix --force`" (it broke Prisma and Expo before) |
| 109 | Production incidents | ✅ | `docs/runbook.md`: what to check for each alert |
| 110 | On-call | 📘 | Rotation and response rules in the runbook. Needs a team to put into practice |
| 111 | Postmortems | ✅ | `docs/postmortem-template.md`, blameless, with actions |

---

## Before launch: the short list

These need your accounts, so they can't be done in code:

1. **Cloudflare** in front of your domain → TLS (#71), HTTP/2-3 (#99), CDN (#48), WAF (#74), DDoS (#75)
2. **A managed Postgres** with backups, a standby and encryption → #32, #72, #85
3. **Prometheus + Grafana** (Grafana Cloud's free tier is enough) reading `/metrics`, with `deploy/prometheus/alerts.yml`
4. **Nightly backups** copied off the server, and one practice restore
5. **Real SMS provider** in `src/shared/sms/sms.ts` (the circuit breaker is already around it)
