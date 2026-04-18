Release notes for Pulsebeat. Version numbers follow [Semantic Versioning](https://semver.org).


## 1.13.1

### What’s changed

- **Degraded view** — Added a **Degraded** stat card for monitors that are up but slow, stale, or below SLO-style 30-day uptime; the list filters accordingly and the URL can include **`filter=degraded`** for a shareable degraded-only view.
- **Response trend** — Row sparklines use the last **18** checks (labelled **Response trend (18)**) with padded leading slots when history is short, per-bar tooltips (en-AU timestamps, Australia/Sydney), and colouring against a **slow** threshold derived from the monitor timeout.
- **Status and stale** — Rows use compact **status dots**; **stale** is when the last check is older than **1.5×** the monitor interval, shown with an amber stripe, **Stale** pill, and degraded routing where relevant.
- **Uptime colouring** — **Uptime 30d** uses **good / warn / danger** buckets (≥99%, ≥95%, below) aligned to the dashboard palette.
- **Tags** — Tag labels use **badge** styling with optional preset accents for common names.
- **Advanced filters** — **Advanced filters** includes **Paused monitors only** (sets **`status=paused`** in the URL alongside other query state).
- **DNS targets** — **DNS** monitors show the configured **hostname** in the target column when it reads more clearly than the raw stored URL.
- **Table headers** — **Uptime 30d** and **Last check** header labels stay on a single line (minimum width and `nowrap`) so the sort glyphs align with other columns.

## 1.13.0

### What’s new

- **Dashboard operational header** — Replaced the personalised greeting with an operational header that shows last refresh timing and fixed auto-refresh cadence for faster situational awareness.
- **Status stat cards** — Introduced clickable **Operational / Down / Paused** cards and an overall 30-day uptime indicator so teams can pivot from summary to filtered view in one click.
- **Filtering and table controls** — Reworked dashboard filtering with search, tag chips, type menu, active filter chips, URL-synced state, and sortable **Uptime 30d** / **Last check** columns for quicker list triage.
- **Inline monitor actions** — Added row-level inline actions for pause/resume, force check, incident deep-linking when a monitor stays down, and quick settings access without leaving the table.
- **Add monitor modal refresh** — Added an in-page **Add monitor** modal with monitor-type presets, advanced options, and immediate row highlighting after creation to keep setup in context.
- **Quick settings workflow** — Added a focused quick settings dialog for common edits (name, cadence, timeout, tags) plus inline delete confirmation for day-to-day maintenance tasks.
- **Pause and resume safeguards** — Added a pause confirmation flow with optional “don’t ask again” preference and a resume toast that confirms reactivation intent and timing.
- **Force-check inline states** — Added inline force-check progress and outcome states so operators can see “checking”, “recovered”, or “still down” context directly in the affected row.
- **Dark-mode readability polish** — Adjusted down-state row and chart incident styling on **Monitor detail** to improve contrast and scanning comfort on dark themes.

## 1.12.0

### What’s new

- **Monitor detail shell** — Added a persistent status header that stays visible while switching between Live, History, and Checks tabs.
- **Response-time chart readability** — Improved y-axis labelling and added incident annotations so outage context is clearer at a glance.
- **History outcomes bar** — Replaced the outcomes pie with a stacked up/down bar so check distribution is easier to scan, including tiny down slices that stay visible.
- **Humanised incident durations** — Incident rows now show readable durations (`sec`, `min`, `h m`) with exact seconds on hover for quicker incident triage.
- **SSL / TLS health placement** — Moved the SSL / TLS health card above the fold and added a details toggle for certificate fields.
- **Monitor config visibility** — Added a dedicated monitor configuration card beside SSL health for quick access to target and check settings.
- **Checks tab overhaul** — Added a canonical **Checks** tab with status filters (**All / UP / DOWN**), date range controls, pagination, CSV export, and incident deep links that jump straight into **History** with the matching window.

## 1.11.0

### What’s new

- **Dashboard UX** — Added a proper loading spinner while monitor data loads, reducing first-load content flash and making startup state clearer.
- **Dashboard table readability** — Slightly increased monitor row text sizing for better legibility while preserving compact table density.
- **Monitor type cues** — Added monitor-type icons in the Host column for HTTP, TCP, Ping, and DNS entries.
- **Alert reliability** — Added an internal down-state confirmation check before opening incidents and sending down notifications to reduce false-negative alerts from transient failures.
- **Security hardening** — Replaced the fixed development JWT fallback secret with an ephemeral per-process secret when `PULSEBEAT_JWT_SECRET` is not set.

## 1.10.2

### What’s changed

- **Security** — Updated **Vite** to a patched release line to address advisories **GHSA-p9ff-h696-f583** and **GHSA-4w7w-66w2-5vf9**.
- **Monitor history (mobile)** — Incident history tables in **Monitor detail** and **Monitor history report** now adapt better on smaller screens, so rows remain readable without awkward clipping.
- **Mobile navigation** — The top header now stays **sticky** while you scroll, making navigation controls easier to reach on phones.

## 1.10.1

### What’s changed

- **Monitor history** — The **checks per day** bar chart legend sits **below** the plot (same treatment as the outcomes pie), so it no longer overlaps tall bars.
- **Monitor history** — **Outcomes** pie and **checks per day** bars use the same **semi-transparent fill** as the response-time chart area (theme fill opacity), with light segment outlines so shapes stay readable on dark backgrounds.
- **Sidebar** — The **account menu** from your avatar stays **inside the sidebar** on **mobile and desktop** (no portal over the main column). On the **collapsed** desktop rail, actions are **icon-only** so they fit the narrow width.
- **Sidebar** — Account actions use an **inline panel** (collapse + bordered paper) above the avatar so the menu reads as a proper control, not floating list rows.

## 1.10.0

### What’s new

- **Mobile sidebar** — The **logo** opens the **dashboard**; the app name beside it is plain text (not a separate link). The **account menu** opened from your avatar stays **inside the drawer** instead of portaling over the dimmed overlay.
- **Monitor detail** — **Live** and **History** tabs: Live keeps the existing view; History adds a **report-style** layout with a **date range**, summary tiles, **MUI X Charts** (**pie** for up/down mix, **stacked bars** for daily checks, **line** for response times), and an **incident table** for the selected window. The API supports **`from` / `to`** (millisecond bounds) on heartbeats and incidents.
- **Dashboard** — **Check now** (**refresh** icon) next to pause runs an immediate check for that monitor and updates the row.
- **Webhook notifications** — Alert **time** uses **en-AU** formatting in **Australia/Sydney** (e.g. **dd/mm/yyyy HH:mm**). **Detail** lines are split into clearer, icon-prefixed lines when the payload uses **·** separators.

### What’s changed (polish)

- **Monitor history** — The **outcomes** pie chart uses a **legend below** the graphic (the built-in legend no longer overlaps the pie).
- **Theme** — **Online / success** green is **muted** for OLED and long sessions; status dots, chips, charts, and latency strips pick it up via the shared design tokens.

## 1.9.0

### What’s new

- **Security (CSP)** — The app sets a fresh **Content-Security-Policy** nonce on each HTML response and applies it to bootstrap `<script>` tags in `index.html`, so inline/module scripts can run without relaxing `script-src` to `'unsafe-inline'`. API responses keep the same connect-src and origin rules as before.
- **Monitor detail** — The **response time** chart uses **MUI X Charts** (`LineChart`) with **DM Sans** axis labels to match the rest of the UI.
- **SSL / TLS health** — The panel title includes a **shield** icon whose colour reflects overall certificate health (neutral when there is no data, green / amber / red when there is).
- **Dashboard** — The monitors table shows **only the first tag** per row (hover the chip to see other tag names when present). A **pause** control next to **edit** toggles the monitor **active** state; when paused it becomes a **play** control to resume.

## 1.8.2

### For administrators

- **Docker** — The image uses an **entrypoint** that starts as root, **`chown`s `PULSEBEAT_DATA_DIR`** (default **`/app/data`**) to the **`node`** user, then runs the server as **`node`**. That fixes **SQLite read-only** errors when the data directory is a bind mount owned by root on the host. If you use **`docker run --user`**, the entrypoint skips **`chown`** and runs your command as that user (ensure the mount is writable for them).

## 1.8.1

### For administrators

- **Docker** — The image runs as the non-root **`node`** user (UID **1000**). **`/app/data`** is created with ownership for that user. If you bind-mount a host directory for persistence, make it writable for UID **1000** (for example `chown 1000:1000` on the host path).

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
