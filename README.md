# Quality Inspection Tracker

A mobile-first web app for shop-floor supervisors to **log, track and resolve fabric quality defects**, replacing the paper register and the spreadsheet re-keying.

**Stack:** React (Vite) · Node.js + Express REST API · PostgreSQL · Docker Compose

| Required (from the brief) | Status |
|---|---|
| Log an inspection: date, machine/line ID, defect type, severity, remarks | Done |
| List with sorting, filtering by severity / status / date range | Done |
| Resolve with a mandatory resolution note | Done: enforced in the UI, the API *and* a DB constraint |
| Summary of Open / Resolved by severity | Done: counts link to the pre-filtered list |
| Mobile-first, usable at 390px | Done: bottom tab bar, card layout, 44px tap targets |
| REST API, PostgreSQL, runs locally in < 5 min | Done: `docker compose up --build` |
| **Bonus:** offline logging that syncs when back online | Done for *logging* (see [limits](#what-i-cut-and-why)) |
| **Bonus:** mock SAP webhook `POST /api/sap-webhook` | Done: payload documented in [docs/API.md](docs/API.md#sap-webhook-mock) |
| **Bonus:** basic authentication | **Not done**, deliberately (see below) |

---

## Quick start (under 5 minutes)

**Prerequisites:** Docker with Compose v2. Nothing else needs installing.

```bash
docker compose up --build
```

Open **http://localhost:3000**. On first boot the database is seeded with ~24 demo inspections so there is something to filter and resolve.

| What | Where |
|---|---|
| App | http://localhost:3000 |
| API (through the same origin) | http://localhost:3000/api/health |
| PostgreSQL (for dev tools) | `localhost:5433`, user/password/db all `qit` |

```bash
docker compose down        # stop (data is kept in a volume)
docker compose down -v     # stop and wipe the data (re-seeds on next start)
```

*Port clashes:* the app uses `3000` and the database is published on `5433` (not `5432`, to avoid a local PostgreSQL). Override with `WEB_PORT=8080 DB_PORT=5544 docker compose up --build`.

**To see it on a phone-sized screen:** open the app in Chrome/Edge, press F12, toggle the device toolbar and pick a 390px-wide device. To try it on a real phone, use the dev setup below with `npm run dev -- --host` and open `http://<your-pc-ip>:5173`.

### Developing without containers for the apps

Run only the database in Docker and the two apps on your machine (Node ≥ 20.6):

```bash
docker compose up -d db

cd backend  && npm install && npm run dev     # API on :4000 (migrates + seeds on boot)
cd frontend && npm install && npm run dev     # app on :5173, proxies /api to :4000
```

Optional: copy `backend/.env.example` to `backend/.env` to change settings. The built-in defaults already match the `db` container.

### Tests

```bash
cd backend  && npm test    # 48 tests: unit tests (no DB) + API integration tests
cd frontend && npm test    # 33 tests: offline queue, filters, validation
```

The backend integration tests run the real Express app against real PostgreSQL, inside a throwaway schema that is dropped afterwards, so they never touch your data. They need the database running (`docker compose up -d db`); if it isn't reachable they are **skipped, not failed**, so check the "skipped" count.

---

## Architecture

```
  Phone browser: React SPA (390px-first)
        │  fetch('/api/…')  ← always same-origin, relative URLs
        ▼
  ┌──────────────────── nginx :3000 ────────────────────┐
  │  serves the built SPA   │   proxies /api → api:4000  │
  └─────────────────────────┴───────────────┬────────────┘
                                            ▼
                               Node.js + Express API
        routes (HTTP + zod validation) → service (rules) → repository (SQL)
                                            ▼
                                     PostgreSQL 16
```

```
backend/src/
  app.js, server.js                  app factory (testable) · bootstrap: migrate → seed → listen
  config/env.js                      zod-validated environment
  db/                                pool, tiny migration runner, SQL migrations, demo seed
  middleware/                        validate (zod), error handler / 404
  modules/inspections/               routes · service · repository · schema · constants
  modules/integrations/              SAP webhook: routes + mapper
frontend/src/
  pages/                             Inspections (list), NewInspection, Summary
  components/                        InspectionCard, FilterBar, ResolveSheet, banners, nav, toast
  hooks/ · api/                      TanStack Query hooks · fetch wrapper + endpoint functions
  offline/                           pending queue, submit-or-queue, background sync
  lib/                               constants, filters (URL state), validation, formatting
```

**Layering rule (backend):** *routes* only translate HTTP ⇄ function calls and validate input; the *service* holds the business rules (idempotent create, resolve = 404/409) and knows nothing about HTTP or SQL; the *repository* is the only place with SQL. Collaborators are passed in as arguments, so the service is tested with an in-memory repository and the HTTP layer against a real database.

## Architecture decisions

1. **Layered modules, no framework magic.** Routes → service → repository, wired together by plain function arguments (`createApp`, `createInspectionService(repo)`). No DI container or decorators. It's easy to read in one sitting, and it still lets tests swap the database for a fake.
2. **Raw SQL with `pg`, no ORM.** There is one table and a handful of queries; an ORM would add more concepts than it removes. All SQL lives in one file, is fully parameterised, and `sortBy` goes through a whitelist, so user input is never concatenated into a query.
3. **`TEXT` + `CHECK` instead of PostgreSQL `ENUM`.** Adding a defect type is a one-line constraint change rather than an `ALTER TYPE` migration, and you still get integrity at the database level. A second constraint requires that a `RESOLVED` row always has a non-blank resolution note, so even a buggy client can't bypass the rule.
4. **Resolve is an action endpoint, not a generic PATCH.** `POST /inspections/:id/resolve` expresses a state transition with a rule attached (note required, one-way). It runs as one atomic `UPDATE … WHERE status = 'OPEN'`, so two supervisors resolving at once can't both win. The loser gets a clear `409`, and the UI handles that case gracefully.
5. **One validation point and one error shape.** Every request is validated by a zod schema in a single middleware, and every failure, including 404s and malformed JSON, comes back as `{ error: { code, message, details? } }`. The frontend maps `details[].field` onto form fields without special cases.
6. **Same-origin everywhere.** The SPA only calls relative `/api/*` URLs. Vite proxies them in development, nginx in Docker. That means no CORS configuration to get wrong and no API URL baked into the JS bundle.
7. **TanStack Query for server state, the URL for filter state.** Query keys share a prefix so one `invalidate` after create/resolve refreshes both the list and the summary. Filters/sort live in the query string, so a refresh keeps your view, and Summary counts can deep-link to `/?severity=CRITICAL&status=OPEN`.
8. **Offline = a persistent queue plus idempotent creates.** The client generates the inspection's UUID *before* the first attempt and reuses it on every retry; the server treats a repeated `id` as "already saved" (`200`, no new row). Because of that, a flaky connection, a double flush or two open tabs can never create duplicates. Only network failures and 5xx are queued; a 4xx is shown to the user and never queued, and an item the server rejects is flagged without blocking the ones behind it.
9. **Dates are strings end to end.** `DATE` columns, JSON and the UI all use `YYYY-MM-DD`; the `pg` driver is told not to convert them to JS `Date`. This avoids the classic bug where an inspection logged on the 19th shows up on the 18th for someone in another timezone.
10. **Migrations run at API start-up.** A ~30-line forward-only runner applies `db/migrations/*.sql` in order, so `docker compose up` needs no manual step. That is fine for one API instance; see "with more time" for what changes at scale.
11. **Plain JavaScript (ESM), not TypeScript.** I chose the lowest-friction route to a project that runs on any machine (no build step on the backend). Types would be the first thing I'd add (see below).

## Assumptions

The brief leaves some things open, so here is what I assumed:

- **Machine / line ID** is free text (as specified), trimmed, 1–50 characters. It is not validated against a master list.
- **The date** is the day the defect was inspected (a calendar date, not a timestamp). The form defaults to today and blocks future dates **in the UI only**. The API accepts any real date because the server runs in UTC, and rejecting "tomorrow" would wrongly block early-morning entries in India.
- **Date-range filter** applies to the inspection date, and both ends are inclusive.
- **Resolved is final.** No reopening or editing. The brief asks only for log / view / resolve.
- **No users.** All supervisors share one list (authentication was an optional bonus and I chose not to do it).
- **Defaults:** the list is sorted newest inspection first, 20 per page with "Load more". Sorting by severity treats Critical > Major > Minor (so descending = most severe first).
- **"Other" defect type** doesn't force remarks, since the brief says remarks are optional.
- **The SAP payload is mocked** by me (modelled loosely on a quality notification): its shape and code mappings are in [docs/API.md](docs/API.md#sap-webhook-mock) and would be replaced by the real interface spec.

## API at a glance

Full reference with examples: **[docs/API.md](docs/API.md)**.

| Method & path | Purpose | Success | Errors |
|---|---|---|---|
| `POST /api/inspections` | Log an inspection (optional client `id` makes it idempotent) | 201 (200 on replay) | 400 |
| `GET /api/inspections` | List: `severity`, `status`, `from`, `to`, `sortBy`, `order`, `page`, `pageSize` | 200 `{data, meta}` | 400 |
| `GET /api/inspections/summary` | Open/Resolved counts per severity | 200 | |
| `GET /api/inspections/:id` | One inspection | 200 | 400, 404 |
| `POST /api/inspections/:id/resolve` | Resolve with `{ resolutionNote }` | 200 | 400, 404, 409 |
| `POST /api/sap-webhook` | Mock SAP notification → inspection (`X-Webhook-Secret` header) | 201 (200 on retry) | 400, 401 |
| `GET /api/health` | Liveness + DB check | 200 | 503 |

Quick check from a terminal (Linux/macOS/Git Bash; in PowerShell use `curl.exe` or `Invoke-RestMethod`):

```bash
curl http://localhost:3000/api/inspections/summary
curl -X POST http://localhost:3000/api/sap-webhook \
  -H "Content-Type: application/json" -H "X-Webhook-Secret: dev-sap-secret" \
  -d '{"notificationId":"QN-1001","workCenter":"LOOM-07","defectCode":"HOLE","priority":"1","reportedOn":"2026-10-19","description":"Hole near selvedge"}'
```

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/sap-webhook `
  -Headers @{ 'X-Webhook-Secret' = 'dev-sap-secret' } -ContentType 'application/json' `
  -Body '{"notificationId":"QN-1001","workCenter":"LOOM-07","defectCode":"HOLE","priority":"1","reportedOn":"2026-10-19"}'
```

## What I cut and why

I'd rather ship something that runs cleanly and say so than pad the feature list.

- **Authentication (bonus):** every user would need an identity, roles and a login screen, which touches every screen and adds setup friction for reviewers. The honest cost of leaving it out is that anyone who can reach the app can read and write, and `source: SAP` can only be trusted because the webhook has its own shared secret. The code is layered so a middleware can slot in without touching services.
- **Offline is "log offline", not "work offline fully":**
  - Logging an inspection offline works, persists across reloads, and syncs automatically and idempotently.
  - **Resolving** offline is not supported, and the list shows whatever was last loaded.
  - There is **no service worker**, so if the page is *reloaded* while offline the app shell won't load. It works when the connection drops while the app is open, which is the common case on a factory floor.
  - The Summary counts reflect the server only, so a queued inspection is shown on the list (dashed card) but not counted until it syncs.
- **Edit/delete inspections, reopening, user attribution, search, CSV export.** None are in the brief.
- **TypeScript, CI pipeline, end-to-end test suite in the repo.** I verified the UI flows with a throw-away browser script (below) but did not commit it.
- **The SAP webhook ships with a default dev secret** (`dev-sap-secret`). Fine for local use, but it must be overridden via `SAP_WEBHOOK_SECRET` anywhere else.

## What I'd do with more time

1. **TypeScript** on both sides, and an **OpenAPI** spec generated from the zod schemas, which would also give the frontend typed API calls.
2. **Real authentication** (SSO or JWT) with roles, plus `created_by` / `resolved_by` and an **audit trail** of state changes.
3. **PWA**: a service worker that caches the app shell and Background Sync, so offline works across reloads and covers resolving too (resolving needs conflict handling, e.g. "someone else already resolved this").
4. **Keyset pagination** instead of `OFFSET` once the table is large, and search by machine/line, with an index to match.
5. **Operational basics:** structured logging with request ids, metrics, a migration advisory lock for multiple API instances, DB backups, CI that runs both test suites plus a Playwright e2e suite.
6. A **master list of machines/lines** (autocomplete) to stop typos like `LOOM7` / `LOOM-07` from splitting reports.

## How this was verified

- `npm test`: 48 backend tests (the API integration tests exercise the main success and error paths against real PostgreSQL) and 33 frontend tests.
- A clean `docker compose up --build` from an empty volume brings up db → api → web (about 80 seconds here with the base images already pulled), with the API healthcheck gating the web container.
- A scripted run in headless Edge at **390×844** exercised: list, load more, status/severity filters, sort, resolve (button disabled until a note is typed), form validation and focus handling, summary deep-links, and the full offline path (queue → reconnect → synced exactly once on the server). It also checked for no horizontal scroll and ≥ 44px tap targets. This script is not included in the repo.
