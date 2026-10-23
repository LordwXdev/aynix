# Aynix runbook

What to do when something goes wrong, and how to do the routine jobs safely.
Keep it short and up to date: whoever is on call should be able to follow it at 3am.

## Service levels (SLOs)

| What we promise | SLI (how we measure it) | SLO (target) | Error budget |
|---|---|---|---|
| The API works | % of requests that don't return 5xx | **99.5%** per 30 days | ~3.6 hours of errors per month |
| The API is fast | p99 latency of `http_request_duration_seconds` | **under 1 s** | 1% of requests may be slower |
| Orders go through | % of `POST /api/orders` that succeed (not 5xx) | **99%** | |
| Deliveries get a driver | time from "confirmed" to "driver assigned" | **under 15 min** for 90% | |

**Error budget rule:** if we use more than half of the month's budget, we pause new features and fix stability first.

## On call

- One person is on call each week. They keep their phone on.
- Alerts come from `deploy/prometheus/alerts.yml`. **page** = act now. **ticket** = fix during the day.
- First reply within 15 minutes for a page. Write in the team chat what you're doing, even "looking".
- After any page: write a postmortem (see `postmortem-template.md`) within 3 days. **No blame.** We fix systems, not people.

## Quick checks

```bash
curl https://YOUR_DOMAIN/health/ready         # database + redis status
docker compose ps                             # what is running, healthy or not
docker compose logs --tail 200 api            # recent API logs (JSON, one line each)
docker compose logs api | grep '"level":50'   # only errors
```

Every log line and every response has a **request id** (`X-Request-Id`). If a user reports a problem, ask for the time, find the request id, then search the logs for it.

## Alerts

### api-errors
More than 2% of requests fail.
1. Check `/health/ready`. If the database is down, see **database down** below.
2. Look at errors: `docker compose logs api | grep '"level":50' | tail -50`.
3. Did it start right after a deploy? Then **roll back** first, investigate after.

### slow-api
p99 is above 1 second.
1. Which route? Look at `http_request_duration_seconds` by `route` in Grafana.
2. Slow database query? Check `pg_stat_statements` or Postgres logs for queries over 1 s. A missing index is the usual cause (see `prisma/schema.prisma` `@@index`).
3. Too much traffic? Add API servers: `docker compose up -d --scale api=3`.

### api-down
1. `docker compose ps`. Restart a dead one: `docker compose up -d api`.
2. If it keeps crashing, read the last logs before it died: `docker compose logs --tail 100 api`.
3. A bad config (missing secret, weak secret in production) stops the API at start, with a clear message.

### no-orders
No orders for 2 hours during the day.
1. Place a test order yourself in the app.
2. Check the products page loads and stores are **ACTIVE** in the admin panel.
3. Check the mobile app can reach the API (DNS, TLS certificate not expired).

### dead-letters
Events kept failing and were saved instead of lost.
1. Admin API: `GET /api/admin/dead-letters` shows them with the error.
2. Fix the cause (for example the SMS provider was down).
3. Replay: `POST /api/admin/dead-letters/:id/retry`. Or dismiss: `POST /api/admin/dead-letters/:id/resolve`.

### memory
Memory keeps growing for hours (possible memory leak).
1. Restart one server at a time (no downtime with 2+ servers).
2. Note the time and what changed recently. Look for things that grow forever: maps, caches, event listeners not removed.

### database down
1. `docker compose ps db`, then `docker compose logs db`.
2. Disk full is the most common cause: `df -h`.
3. If the data is damaged, **restore the last backup** (below).

## Routine jobs

### Deploy a new version (rolling, no downtime)
CI builds images tagged with the commit (`sha-abc1234`) or the version (`v1.2.0`).
```bash
docker compose pull            # or: docker compose build
docker compose run --rm migrate   # database changes first (they must be backward compatible)
docker compose up -d --no-deps --scale api=3 api   # servers are replaced one by one
```
Each server stops cleanly: it says "not ready", finishes running requests, then exits.

**Database changes must be backward compatible** (expand, then contract): add new columns first, deploy code that uses them, and only remove old columns in a later release. Then old and new servers can run at the same time during a rolling deploy.

### Roll back
Run the previous image tag:
```bash
API_TAG=sha-previous docker compose up -d api
```
Migrations are not undone automatically. That's why they must be backward compatible (see above).

### Backups
```bash
docker compose run --rm backup     # writes ./backups/aynix-YYYYMMDD-HHMMSS.dump
```
Run it every night (cron on the server, or your host's automatic backups) and copy the files **off the server** (S3, Backblaze…). Keep 7 daily + 4 weekly.

### Restore (test this every month)
```bash
docker compose exec db createdb -U aynix aynix_restore
docker compose exec -T db pg_restore -U aynix -d aynix_restore < backups/FILE.dump
# check it, then point DATABASE_URL to it, or swap the databases
```
A backup is only real once you've restored it.

### Rotate the JWT signing key
1. Set `JWT_SECRET_PREVIOUS` to the current key and `JWT_SECRET` to a new random one (32+ characters).
2. Deploy. Old tokens still work.
3. After 15 minutes (the access-token lifetime), remove `JWT_SECRET_PREVIOUS` and deploy again.

### Rotate the database password
Change it in Postgres, update `DATABASE_URL` / `POSTGRES_PASSWORD`, then do a rolling restart.

## Disaster recovery targets

| | Target |
|---|---|
| **RPO** (how much data we can lose) | 24 hours with nightly backups. Use your host's point-in-time recovery to get down to minutes |
| **RTO** (how long to be back up) | 2 hours: new server, `docker compose up`, restore the last backup |
