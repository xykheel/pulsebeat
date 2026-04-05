Release notes for Pulsebeat. Version numbers follow [Semantic Versioning](https://semver.org).


## 1.8.0

### What’s new

- **Dashboard** — Monitors are shown in a clear table: name and target, status, a compact response-time strip for recent checks, type, coloured **tags**, and a shortcut to edit. Filter by type, status, or tags, search by name or address, and page through the list. At the top, **Up**, **Down**, and **Paused** summaries include a light trend in the background for the last day.
- **Navigation** — A **collapsible sidebar** on the left holds the Pulsebeat name, version, main sections, and your account. On a wide screen you can narrow it to icons only; your choice is remembered. On phones and small tablets, the menu opens from the side when you tap the menu control; the rest of the screen stays focused on your content.
- **Tags** — Create tags with colours from **Add monitor** or **Edit monitor** (including **Manage tags**), then attach them to monitors. Tags appear as chips on the dashboard and help you filter what you’re looking at.
- **DNS checks** — Add monitors that resolve hostnames (common record types supported). You can optionally require a specific answer and use a custom resolver. Results appear on the monitor’s detail page.
- **Maintenance windows** — Schedule times when checks still run but **alerts and new incidents are paused**—for example during planned work. Set them under **Maintenance**; the dashboard and affected monitors show a clear notice while a window is active. Recurring schedules can follow a cron-style pattern in your chosen timezone.
- **SSL and certificates** — For HTTPS monitors with certificate checks enabled, Pulsebeat records richer certificate details and shows a **health** view on the monitor page: status, time to expiry, TLS version, trust, and history. Under **Settings** you can tune warning levels and optional alerts for self-signed certs or older TLS.
- **Version** — The running version appears in the sidebar (when expanded) and under **Settings → About**.

### For administrators

- Upgrades apply **database updates automatically** on first start. If you host Pulsebeat behind your own domain, see earlier notes (v1.6.0) about allowed origins in your environment.

### What’s changed (1.8.0 follow-up)

- **Layout** — The sidebar stays within the viewport height while the main area scrolls, so long pages no longer stretch the navigation column.
- **Settings** — Options are organised under tabs (General, Data retention, Self-monitoring, SSL alerting, About); only the active tab’s cards are shown. Tag management is no longer on this page.
- **Tags** — Create, edit, and delete tags from the monitor dialog (**New tag** / **Manage tags**) so tagging stays next to where you assign monitors.
- **Branding** — The Pulsebeat mark in the sidebar, login screen, and monitor detail header uses the **Ssid chart** icon instead of the heart.
- **Housekeeping** — Removed dead exports and unused helpers flagged by static analysis (theme barrel, notification providers, database internals, maintenance helpers), added a direct **`@mui/system`** dependency for typings, and fixed Express ambient typings to import **`express`**.

## 1.7.1

### What’s changed

- **Dashboard** — Uptime bar and response sparkline are grouped in one strip with clearer labels and a slightly larger sparkline.

## 1.7.0

### What’s new

- **Resource usage (Settings)** — When Pulsebeat runs in **Docker** (or a similar Linux container), **Settings** can show live **CPU**, **memory**, **network**, and related stats. Figures refresh while you stay on the page. Simpler environments may show a smaller subset.

## 1.6.1

### What’s changed

- **Settings** — Notification channels and account password are managed from their own areas in the app (not buried inside Settings).

## 1.6.0

### What’s new

- **Hosting behind a domain** — If you access Pulsebeat from a specific website address, you can list those addresses in your server configuration so the browser is allowed to talk to the app securely. See your deployment guide for the exact variable name.

## 1.5.0

### What’s new

- **Settings** — Configure the app name, defaults for new monitors, how long history is kept (with optional cleanup), notification channels, optional **password protection**, and **About** (version, uptime, optional project link).
- **TLS on HTTPS monitors** — Optionally verify certificates after a successful check; expiry and basics show in the UI.
- **Monitor detail** — Recent checks in a table, clearer TLS notes, and updates pause when the browser tab is in the background.

## 1.4.0

### What’s new

- **Small screens** — Dashboard and Notifications stay easy to reach from a slide-out menu.
- **Monitor detail** — Top summary is easier to read, with clearer spacing and status wording.

## 1.3.0

### What’s new

- **Navigation** — Icons for main sections and an account menu (**Change password**, **Sign out**).
- **Change password** — Dedicated page with sensible security rules.
- **Look and feel** — Softer greens and reds for status on dark backgrounds.

## 1.2.0

### What’s new

- **Reliability and design** — Internal codebase and theming improvements for a more consistent, maintainable experience.

## 1.1.0

### What’s new

- **After you upgrade** — A short “what’s new” summary when you open the app.
- **Version in the app** — Easier to confirm you’re on the build you expect.

## 1.0.0

### Welcome to Pulsebeat

- **Uptime checks** — Keep an eye on websites and services with HTTP, TCP, and Ping monitoring.
- **Clear dashboard** — See what’s up or down at a glance, with uptime history and response times.
- **Incident history** — Downtime is recorded automatically so you can review what happened and when.
- **Alerts your way** — Send notifications to many popular services (messengers, email, webhooks, and more).
- **Runs at home** — Packaged for Docker, including on Raspberry Pi, with your data stored locally.
