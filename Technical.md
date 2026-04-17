# Pulsebeat — technical reference

This document describes how the Pulsebeat repository is structured, which technologies it uses, and how the major subsystems fit together. It is aimed at developers and operators who need to deploy, extend, or debug the application.

## Product summary

Pulsebeat is a **self-hosted uptime and health console**. It stores configuration and history in a **SQLite** database, runs periodic checks from a **Node.js** server, and serves a **React** single-page application (SPA) for the UI. Alerts can be sent through many **notification channels** (webhooks, chat, email, and others).

Canonical user-facing release notes live in **`CHANGELOG.md`** at the repository root; `npm run dev`, `npm run build`, and `npm run sync-changelog` copy that file to **`client/public/CHANGELOG.md`** and **`server/CHANGELOG.md`** so the built app and server can expose the same text.

---

## Repository layout

| Path | Role |
|------|------|
| **`package.json`** (root) | npm **workspaces** (`client`, `server`); scripts orchestrate changelog sync, dev, build, and production start. |
| **`client/`** | Vite + React SPA; production assets are emitted to **`client/dist`**. |
| **`server/`** | Express API, SQLite access, background check scheduler, static file serving in production. |
| **`Dockerfile`** | Multi-stage image: builds the client, installs server dependencies, copies built static files into the server tree. |
| **`docker-compose.yml`** | Example compose service with data volume and common environment variables. |
| **`docker-entrypoint.sh`** | Ensures data directory ownership when running as root, then drops to the `node` user. |
| **`scripts/sync-changelog.ts`** | Copies root `CHANGELOG.md` into client public and server directories. |
| **`.env.example`** | Documents environment variables for local development (not exhaustive; see below). |

There is **no** `.github/` workflows directory in this tree; CI/CD is not defined in-repo here.

---

## Runtime and language versions

- **Node.js**: `Dockerfile` uses **`node:20-bookworm`**. Local development should use a compatible **Node 20+** runtime.
- **TypeScript** is used in both workspaces (`typescript` ^5.7).
- **Module system**: both `client` and `server` use **`"type": "module"`** (ESM). Server source imports use **`.js` extensions** in import paths (TypeScript emits ESM-compatible resolution).

---

## Architecture overview

### Single-process deployment

In production, one Node process:

1. Listens for HTTP (default **`0.0.0.0:4141`**, overridable with **`PORT`**).
2. Serves **`/api/*`** JSON APIs.
3. Serves the built SPA from a resolved static directory (see **Static assets**).
4. Runs **interval-based monitor checks** in-process (`setInterval` per active monitor).
5. Periodically **prunes** old heartbeats and resolved incidents.

There is no separate worker service; scaling is **vertical** (single instance) by design.

### Development split

- **Client dev server** (Vite) on **port 5173**, with a proxy so **`/api`** goes to **`http://localhost:4141`** (`client/vite.config.ts`).
- **Server** runs separately on **4141** (`npm run dev -w server`).

Cookies for JWT sessions work in this setup because the browser talks to the Vite origin and the proxy forwards `/api` to the API with cookies.

---

## Frontend (`client/`)

### Stack

- **React 18** with **react-router-dom** for routing.
- **MUI v5** (`@mui/material`, icons, system) and **Emotion** for component styling.
- **MUI X Charts** for charts on monitor detail and reports.
- **Tailwind CSS** with **Preflight disabled** and **`important: '#root'`** so utilities can override MUI where needed (`client/tailwind.config.mjs`).
- **react-markdown** (e.g. changelog display).
- **Vite 6** with `@vitejs/plugin-react`.

### Application structure

- **Entry**: `client/src/main.tsx`; **`index.html`** sets `lang="en-AU"` and loads DM Sans / JetBrains Mono from Google Fonts.
- **Routing** (`client/src/App.tsx`): lazy-loaded pages for dashboard, monitor detail, notifications, maintenance, settings, and change-password; login when unauthenticated.
- **Auth**: `client/src/contexts/AuthContext.tsx` calls **`GET /api/auth/me`** with **`credentials: 'include'`**. Failed API responses dispatch a **`pulsebeat:unauthorized`** window event (`client/src/api.ts`).
- **API helpers**: `client/src/api.ts` wraps `fetch` with credentialed requests and JSON handling.
- **Theming**: `client/src/theme/` — central brand tokens, MUI theme factory, glass-style presets, CSS variables for Tailwind alignment.

### Monitor detail (v1.12.0 UI shell)

- **Persistent header**: `client/src/pages/MonitorDetail.tsx` keeps the status/context header (name, state chips, actions) outside tab panels so it persists across **Live**, **History**, and **Checks**.
- **Tab split**: Live now focuses on current state and preview data; History keeps the date-range report (`MonitorHistoryReport`); Checks is the canonical table workflow with status filters (all/up/down), explicit date-range loading, and paginated results for larger datasets.
- **Checks export and incident drill-in**: Checks supports CSV export of the active filtered set, and down rows can deep-link to the related incident in History by switching tabs and preloading the incident-aligned date window.
- **History outcomes visual**: `client/src/components/MonitorHistoryReport.tsx` uses a full-width stacked up/down bar (with inline labels and a legend) instead of the pie; tiny down percentages are clamped to a minimum visible width so they are still noticeable.
- **Incident duration readability**: incident rows in the same report render plain-language durations (`sec`, `min`, `h m`) from `client/src/utils/incidentDuration.ts`, while tooltips retain exact seconds for precision.
- **Response chart clarity**: `client/src/components/ResponseTimeChart.tsx` improves y-axis value formatting for readability and overlays incident annotations (up to eight nearest incidents) on the line chart.
- **Above-the-fold cards**: Live uses a side-by-side grid for `SslHealthPanel` and a new monitor config summary card so TLS health and core check settings are immediately visible.
- **TLS details interaction**: `client/src/components/SslHealthPanel.tsx` adds a compact details toggle so certificate metadata is available on demand without increasing default card height.

### Build output

- **`npm run build -w client`** runs `tsc --noEmit` then **`vite build`**, outputting to **`client/dist`**.

---

## Backend (`server/`)

### Stack

- **Express 4** with **`compression`**, **`helmet`**, **`cookie-parser`**, **`express.json`** (512 KB body limit).
- **better-sqlite3** for synchronous SQLite access in the main thread (typical for this workload).
- **jsonwebtoken** for JWT signing and verification.
- **bcryptjs** for password hashing (cost factor **12**).
- **nodemailer** for SMTP notification delivery.
- **cron-parser** for recurring maintenance windows.
- **tsx** runs TypeScript directly in dev and production (`npm run start` sets `NODE_ENV=production`).

### Request pipeline (`server/index.ts`)

Order of middleware and routes (simplified):

1. **Per-request CSP nonce** — random 128-bit nonce stored in `res.locals.cspNonce`; **`index.html`** is served with nonces injected into `<script>` tags so `script-src` can avoid blanket `'unsafe-inline'`.
2. **CORS safelist** — `allowedOrigins.ts`: if `Origin` matches **`PULSEBEAT_ALLOWED_ORIGINS`**, sets credentialed CORS headers and handles **`OPTIONS`** preflight for `/api`.
3. **Helmet** — `buildHelmetOptions()` sets a strict **Content-Security-Policy** (default-src `'self'`, nonce-based `script-src`, Google Fonts for `styleSrc`/`fontSrc`, `connect-src` includes `'self'` plus allowed origins and matching **`ws:`/`wss:`** variants). `crossOriginEmbedderPolicy` is disabled.
4. Compression, cookie parsing, JSON body parser.
5. **Public endpoints**: `GET /api/health`, `GET /api/auth/status` (password protection flag).
6. **`/api` JWT attachment**: `attachUserFromJwt` reads **`pulsebeat_token`** cookie or **`Authorization: Bearer`**. If password protection is **disabled** in settings, unauthenticated users become a **guest** user (`id: -1`) for authorised routes.
7. **Mounted routers** (most require `requireAuth`): `auth`, `summary`, `notifications`, `monitors`, `tags`, `maintenance-windows`, `settings`, plus `GET /api/app-info` (version + changelog).
8. **Static SPA** + fallback: `GET *` returns `index.html` with script nonces for non-`/api` paths.
9. **Error handler**: generic 500 JSON; message included in non-production.

On listen, the server calls **`rescheduleAll()`** (checker) and **`startPruneJob()`**.

### Authentication and sessions

- Cookie name: **`pulsebeat_token`** (`server/auth/tokens.ts`).
- JWT signed with **`PULSEBEAT_JWT_SECRET`** (minimum **16** characters). In **production**, missing/short secret **exits the process**. In development, an ephemeral random secret is logged once per process start.
- Token expiry: **7 days** (`expiresIn: '7d'`).
- Cookie options: **httpOnly**, **`secure` in production**, **sameSite: `lax`**, **7-day maxAge**, path `/`.
- **Login rate limit**: in-memory, per IP, **40 attempts / 15 minutes** (`server/routes/auth.ts`). Password change and notification test endpoints have separate limits.
- **Password protection** can be toggled in app settings (`password_protection_enabled`). When off, the dashboard is open and **`/api/auth/login`** returns 400.

### Static assets resolution

`resolveStaticDir()` tries, in order:

1. **`PULSEBEAT_STATIC_DIR`** (Docker sets this to `/app/server/public`).
2. **`server/public`** next to the running `index.ts`.
3. **`../client/dist`** relative to server (local production-style run after `vite build`).

The first directory containing **`index.html`** wins.

---

## Data layer

### SQLite files and pragmas

- Default data directory: **`PULSEBEAT_DATA_DIR`** or **`../data`** relative to server when unset.
- Database file: **`PULSEBEAT_DB_PATH`** or **`<dataDir>/pulsebeat.db`**.
- **WAL** journal mode and **`foreign_keys = ON`**.

### Schema (conceptual)

Core tables (see `server/db.ts` and `server/migrations/*.sql`):

- **`monitors`** — name, **type** (`http`, `tcp`, `ping`, **`dns`**), `url`, interval/timeout/retries, `active`, **`check_ssl`**, **`dns_config`** (JSON string for DNS monitors).
- **`heartbeats`** — per-check results: status, latency, message, **`resolved_value`** (e.g. DNS resolution text), **`maintenance`** flag, `checked_at`.
- **`incidents`** — downtime intervals with optional cause text.
- **`notifications`** + **`monitor_notifications`** — channel definitions (JSON `config`) and many-to-many links to monitors.
- **`users`** — seeded on first run; usernames matched case-insensitively for login.
- **`settings`** — key/value app configuration (defaults merged in code).
- **`tags`** + **`monitor_tags`** — labels with hex colours.
- **`maintenance_windows`** — absolute or recurring windows; optional per-monitor or all-monitors (`monitor_id` **NULL**); cron + timezone for recurrence.
- **`ssl_checks`** — TLS/certificate snapshots for HTTPS monitors with SSL validation enabled.

### Migrations

`server/migrate.ts` runs numbered **`NNN_*.sql`** files once, recording versions in **`schema_migrations`**. Initial `CREATE TABLE` in `db.ts` is complemented by migrations for tags, heartbeat columns, maintenance, SSL, and broadening monitor `type` to include **`dns`**.

### Retention and pruning

- Settings **`heartbeat_retention_days`** and **`incident_retention_days`** (each capped **3650** in code paths that parse them).
- **`runRetentionPrune()`** deletes old heartbeats and **resolved** incidents past retention.
- **`startPruneJob()`** runs pruning every **6 hours**.

---

## Monitoring engine (`server/checker.ts`)

### Scheduling

- Each **active** monitor gets a **`setInterval`** keyed by monitor id; interval is **`max(5, interval_sec) * 1000` ms**.
- First tick runs after ~**1.5 s** delay.
- Creating/updating/deleting monitors updates or clears timers via **`scheduleMonitor`** / **`clearMonitorSchedule`** / **`rescheduleAll`**.

### Check types

| Type | Behaviour |
|------|-----------|
| **http** | `fetch` **GET**, follows redirects, `User-Agent: Pulsebeat/1.8`. Success requires **`res.ok`**. Optional **TLS validation**: if **`check_ssl`** is on and URL is **`https:`**, performs an additional **`tls.connect`** validation and records **`ssl_checks`** rows; can trigger SSL-specific notifications. |
| **tcp** | Parses `tcp://host:port` or `host:port`; **`net.createConnection`** with timeout. |
| **ping** | Runs **`ping -c 1 -W <wait>`** via **`execFile`** (expects a `ping` binary; **Linux-style flags**). Parses latency from output when possible. |
| **dns** | Uses **`dns.promises.Resolver`**; optional custom resolver; supports **A, AAAA, CNAME, MX, TXT** via JSON in **`dns_config`**; optional **expected** substring/IP match. |

### Down detection and incidents

- **Down confirmation**: after a failure when the previous heartbeat was up, the checker may repeat the check once (with **`DOWN_CONFIRMATION_ATTEMPTS`**) to reduce flapping.
- **Retries** (per monitor): for TCP, ping, and DNS, failed attempts retry with a short delay; HTTP retries on non-success/errors inside **`checkHttp`**.
- **Incidents**: opening when transitioning to down (outside maintenance), resolving when returning to up; notifications fire on **down** and **up** transitions.

### Maintenance windows (`server/maintenance.ts`)

- If a monitor is in an active window, heartbeats are still recorded with **`maintenance = 1`**, but **incident open/resolve** and **monitor event notifications** are skipped.
- Recurring windows use **cron-parser** with a configured **IANA timezone** (default **`Australia/Sydney`** in several code paths).

### SSL alerting

When **`check_ssl`** is enabled, SSL rows are inserted and **`maybeSslNotify`** may send alerts for certificate expiry thresholds, self-signed certs (if enabled), TLS version below 1.2 (if enabled), and status regressions — subject to settings **`ssl_warning_days`**, **`ssl_critical_days`**, **`ssl_alert_self_signed`**, **`ssl_alert_tls_below_12`**.

---

## Notifications (`server/notifications/`)

Notification **`type`** values are implemented in **`providers.ts`** and exposed at **`GET /api/notifications/types`**.

Supported types include: **telegram**, **discord**, **slack**, **smtp**, **webhook** (custom URL/method/headers/body template with `{{title}}` / `{{body}}` placeholders), **teams**, **pushover**, **pushbullet**, **pagerduty**, **gotify**, **ntfy**, **signal**, **rocketchat**, **matrix**, **twilio**, **apprise**.

Dispatch is async; monitor and SSL alerts use **`Promise.allSettled`** and swallow per-channel errors at the call site. Alert timestamps are formatted in **`en-AU`** with timezone **`Australia/Sydney`**.

---

## HTTP API surface (summary)

Base path **`/api`**. Unless noted, routes expect JSON and require authentication when password protection is enabled.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness: `{ ok: true }` |
| GET | `/api/auth/status` | `{ passwordRequired: boolean }` |
| POST | `/api/auth/login` | Body: username/password; sets cookie |
| POST | `/api/auth/logout` | Clears cookie |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/password` | Change password (not for guest user) |
| GET | `/api/summary` | Aggregated dashboard stats + 24h sparkline series |
| GET | `/api/notifications/types` | Sorted list of provider type strings |
| GET/POST | `/api/notifications` | List / create channels |
| PUT/DELETE | `/api/notifications/:id` | Update / delete |
| POST | `/api/notifications/:id/test` | Send test (rate limited) |
| GET | `/api/monitors` | List monitors with enriched stats |
| POST | `/api/monitors` | Create monitor |
| GET | `/api/monitors/:id` | Detail |
| PUT | `/api/monitors/:id` | Update |
| DELETE | `/api/monitors/:id` | Delete |
| POST | `/api/monitors/:id/check` | Run check immediately |
| GET | `/api/monitors/:id/heartbeats` | Query params: `limit`, optional `from`/`to` ms |
| GET | `/api/monitors/:id/incidents` | Same window params |
| GET | `/api/monitors/:id/ssl-checks` | Query param: `limit` |
| PUT | `/api/monitors/:id/tags` | Body: `tag_ids` |
| GET | `/api/tags` | List tags |
| POST | `/api/tags` | Create |
| PUT/DELETE | `/api/tags/:id` | Update / delete |
| GET | `/api/maintenance-windows` | List windows |
| GET | `/api/maintenance-windows/active` | Currently active subset |
| POST | `/api/maintenance-windows` | Create (supports bulk targets) |
| PUT/DELETE | `/api/maintenance-windows/:id` | Update / delete |
| GET/PUT | `/api/settings` | Read / update public settings fields |
| POST | `/api/settings/purge` | Run retention prune manually |
| GET | `/api/settings/about` | Version, Node version, process uptime, optional GitHub URL |
| GET | `/api/settings/container-stats` | cgroup/process resource snapshot (`containerMetrics.ts`) |
| GET | `/api/app-info` | Package version + changelog markdown (from server `CHANGELOG.md`) |

**CORS**: only origins listed in **`PULSEBEAT_ALLOWED_ORIGINS`** receive `Access-Control-Allow-Origin` and credentials support.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| **`PORT`** | HTTP listen port (default **4141**). |
| **`NODE_ENV`** | **`production`** enables stricter cookie `secure`, generic 500 messages, startup log line, JWT secret enforcement. |
| **`PULSEBEAT_DATA_DIR`** | SQLite directory (default `../data` from server cwd). |
| **`PULSEBEAT_DB_PATH`** | Optional explicit database file path. |
| **`PULSEBEAT_STATIC_DIR`** | Directory containing built SPA **`index.html`**. |
| **`PULSEBEAT_JWT_SECRET`** | JWT HMAC secret (**≥ 16** chars); **required** in production. |
| **`PULSEBEAT_ADMIN_USER`** | First-user username when DB empty (default **`admin`**). |
| **`PULSEBEAT_ADMIN_PASSWORD`** | Initial password when no users exist; if unset in production, a **random password is printed once** to logs. |
| **`PULSEBEAT_ALLOWED_ORIGINS`** | Comma-separated **absolute origins** (`https://host`, no path) for CORS + CSP `connect-src`. |
| **`PULSEBEAT_GITHUB_URL`** | Optional URL returned on **Settings → About** (`/api/settings/about`). |

---

## Docker and production packaging

- **Build stage**: installs **client** dependencies, copies sources, syncs changelog into `public`, runs **`npm run build`**.
- **Runtime stage**: installs **build tooling** (`python3`, `make`, `g++`) so **better-sqlite3** native bindings compile on **amd64** and **arm64**.
- Server dependencies are installed with **`npm install --omit=dev`**; runtime uses **`tsx`** to execute **`index.ts`**.
- **`EXPOSE 4141`**. **`PULSEBEAT_DATA_DIR=/app/data`** by default; volume mount recommended.
- **Entrypoint** creates/chowns data dir for user **`node`** when started as root.

### Operational notes for monitors in containers

- **ICMP ping** typically requires **extra Linux capabilities** or a suitable **`ping`** implementation inside the image; if ping fails, prefer **HTTP** or **TCP** checks.
- The checker’s ping command uses **Linux-style** `ping` arguments.

---

## Container metrics (`server/containerMetrics.ts`)

**`GET /api/settings/container-stats`** attempts to read **cgroup v2** (CPU, memory, pids, block IO when available), then falls back to **cgroup v1 memory**, then **process RSS** and **`/proc/net/dev`**-derived network totals. Values are best-effort and may be `null` outside containerised Linux.

---

## Root npm scripts

| Script | Behaviour |
|--------|-----------|
| **`npm run sync-changelog`** | Copies root `CHANGELOG.md` to client public and server. |
| **`npm run dev`** | Syncs changelog, then runs **server** and **client** dev servers concurrently. |
| **`npm run build`** | Syncs changelog, then **`npm run build -w client`**. |
| **`npm run start`** | **`npm run start -w server`** (production mode). |
| **`npm test`** | Server + client **typecheck**, then **client build** (sanity compile). |

---

## Versioning

Workspace packages share the same **`version`** field in root, **`client/package.json`**, and **`server/package.json`** (see README). The server **`/api/app-info`** and **`/api/settings/about`** read version from **`server/package.json`**.

---

## Security considerations (brief)

- **Secrets**: protect **`PULSEBEAT_JWT_SECRET`** and notification channel credentials; the DB holds JSON configs for providers.
- **TLS**: reverse proxies should terminate HTTPS; set **`PULSEBEAT_ALLOWED_ORIGINS`** to match the public UI origin so browsers can call the API with cookies.
- **Guest mode**: disabling password protection assigns a synthetic guest user for API access; treat this as **trusted-network only**.
- **Rate limits** on login, password change, and notification tests are **in-memory** (reset on process restart; not suitable for multi-instance horizontal scaling).

---

## Licence

See **`LICENSE`** in the repository root.
