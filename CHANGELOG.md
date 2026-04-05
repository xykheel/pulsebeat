Release notes for Pulsebeat. Version numbers follow [Semantic Versioning](https://semver.org/).


## 1.7.1

### What’s changed

- **Dashboard cards** — Uptime bar and response sparkline sit in a single metrics strip under a light divider (no extra vertical stretch). Labels use consistent uppercase captions and spacing; sparkline is slightly larger and aligned with its label.

## 1.7.0

### What’s new

- **Self-monitoring (Settings)** — **Resource usage** panel with Docker-style metrics: CPU %, memory (usage / limit), cumulative Net I/O, block I/O, and PIDs, read from **cgroup v2** when available (typical in modern Docker). Polls every **3 seconds** while the Settings page is open and the tab is visible. Falls back to cgroup v1 memory-only or process-level stats when cgroups are not exposed.

## 1.6.1

### What’s changed

- **Settings** — The **Notifications** and **Authentication** sections were removed from the Settings page. Use **Notifications** in the nav for channels and **Account → Change password** for the admin password.

## 1.6.0

### What’s new

- **Allowed origins** — Set `PULSEBEAT_ALLOWED_ORIGINS` to a comma-separated list of absolute origins (for example `https://pulsebeat.example.com`). Each entry is added to **Content-Security-Policy** `connect-src` (with matching `ws:` / `wss:` where applicable) and may receive **credentialed CORS** responses for `/api` requests. If a reverse proxy injects its own **Content-Security-Policy-Report-Only** (for example `connect-src 'none'`), adjust or remove that header at the proxy; Pulsebeat cannot override headers added in front of the app.

## 1.5.0

### What’s new

- **Settings** — New **Settings** page (`/settings`) stores options in SQLite: app display name, default monitor interval/timeout/retries, heartbeat and incident retention (with estimated database file size and a **Purge old data now** action), notification channel list with enable/disable and delete, optional **password protection** toggle with admin password stored as a bcrypt hash (synced with the seeded admin user), and **About** (app version, process uptime, Node.js version, optional GitHub link via `PULSEBEAT_GITHUB_URL`).
- **TLS monitoring** — HTTP monitors can **validate TLS certificates** on `https://` URLs after a successful response; expiry and subject appear in check messages and on the monitor detail **SSL / TLS** section.
- **Monitor detail** — **Recent checks** table (latest 50 heartbeats), TLS summary for HTTPS monitors, **TLS** badge when validation is enabled, and polling pauses when the document tab is hidden.

## 1.4.0

### What’s new

- **Mobile navigation** — On smaller viewports, **Dashboard** and **Notifications** move into a **hamburger menu** (drawer) so the bar stays usable; desktop layout is unchanged.
- **Monitor detail summary** — The top metrics card uses a clearer **grid** layout with more **spacing**, readable **labels**, and a **status chip** that wraps on its own line so it no longer overlaps the “Latest check” timestamp.

## 1.3.0

### What’s new

- **Navigation** — Dashboard and Notifications sit beside the Pulsebeat brand on the left; each has a clear icon. Your account uses an **avatar** with a menu for **Change password** and **Sign out**.
- **Change password** — New page under **Account → Change password** (`/account/password`) with a secure API (current password check, rate limiting, minimum length).
- **Page headers** — Monitors, Notifications, monitor detail, and change-password views show a matching header icon.
- **Status colours** — Online/offline greens and reds are **softer** (mint and coral tones) for long sessions on dark backgrounds.

## 1.2.0

### What’s new

- **TypeScript everywhere** — The server, client, and tooling scripts are written in TypeScript for safer refactors and clearer APIs. The server runs via `tsx`; the client build type-checks before Vite bundles.
- **Design system** — Brand colours, typography, and layout tokens live in one place (`theme/tokens.ts`), with a MUI theme, shared `sx` presets, and CSS variables on `:root` for non-MUI surfaces.
- **Tailwind CSS** — Tailwind is integrated alongside Material UI (preflight off, scoped to `#root`) for layout and utilities; nav and several shells use utility classes tied to the same brand tokens.

## 1.1.0

### What’s new

- **What’s new dialog** — When you open Pulsebeat after an upgrade, you’ll see a short summary of changes so you always know what’s different.
- **App version** — The running version is now tracked and shown with the update notes, so you can confirm you’re on the latest build.

## 1.0.0

### Welcome to Pulsebeat

- **Uptime checks** — Keep an eye on websites and services with HTTP, TCP, and Ping monitoring.
- **Clear dashboard** — See what’s up or down at a glance, with uptime history and response times.
- **Incident history** — Downtime is recorded automatically so you can review what happened and when.
- **Alerts your way** — Send notifications to many popular services (messengers, email, webhooks, and more).
- **Runs at home** — Packaged for Docker, including on Raspberry Pi, with your data stored locally.
