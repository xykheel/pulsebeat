# Pulsebeat

**Pulsebeat** is a self-hosted uptime and health console for the services you care about. Watch HTTP, TCP, ping, and DNS targets from one place: a fast **dark, glass-style UI**, **SSL/TLS insight** for HTTPS checks, **tags and filters**, **maintenance windows** that silence alerts during planned work, and **notification channels** (including webhooks) so your team hears about incidents on your terms.

Run it at home, on a VPS, or in Docker — your data stays **yours**, in a **SQLite** database you control.

<p align="center">
  <img src="docs/images/pulsebeat-monitor-detail.png" alt="Pulsebeat monitor detail — Live view with response time chart, uptime, and SSL/TLS certificate health" width="920" />
</p>
<p align="center">
  <img src="docs/images/pulsebeat-hub.png" alt="Pulsebeat — uptime dashboard, webhook alerts, maintenance windows, self-monitoring, and rich per-monitor analytics" width="920" />
</p>

---

## Highlights

- **Dashboard operations hub** — Redesigned operational header, clickable status stat cards, stronger filtering, sortable table columns, and URL-synced list state for faster triage.
- **Inline actions that keep context** — Pause/resume, force-check with inline progress/outcome states, incident deep-linking, and quick settings are all available from each monitor row.
- **In-place monitor management** — Add monitors in a focused modal (with advanced options) and quick-edit common settings without leaving the dashboard.
- **Monitor detail** — A persistent status header across **Live**, **History**, and **Checks**, with a canonical Checks tab that supports status filters, date-range queries, pagination, CSV export, and incident deep links into History.
- **Monitor analytics** — History uses a full-width stacked outcomes bar (with always-visible down segments and legend), plain-language incident durations with precise-seconds tooltips, and response-time charts tuned for faster outage triage.
- **Dark-mode accessibility polish** — Monitor detail table and chart down-state contrast has been refined to improve readability in low-light operational setups.
- **SSL and config at a glance** — Above-the-fold **SSL / TLS health** (with details toggle) sits beside a dedicated monitor config card.
- **Alerts** — Wire up Telegram, email, Discord, Slack, custom webhooks, and more.
- **Maintenance** — Schedule windows so checks still run but alerts stay quiet.
- **Settings** — Tune defaults, retention, SSL alerting, optional **container/self-monitoring** stats, and **About** metadata.

Access is **password-protected** with **JWT** sessions (`httpOnly` cookies); the same API can be used with `Authorization: Bearer` for automation.

---

## Quick start (Docker)

The official image serves the **web UI and REST API** on **port 4141** from a single process.

```bash
services:
  pulsebeat:
    image: replace_with_your_image_repo_and_tag
    container_name: pulsebeat
    restart: unless-stopped
    mem_limit: 512m
    ports:
      - "4141:4141"
    volumes:
      - ./data:/app/data
    environment:
      NODE_ENV: production
      PULSEBEAT_DATA_DIR: /app/data
      PULSEBEAT_JWT_SECRET: `openssl rand -hex 32`
      PULSEBEAT_ADMIN_PASSWORD: replace_with_my_password
      PULSEBEAT_ADMIN_USER: replace_with_my_user
      PULSEBEAT_ALLOWED_ORIGINS: https://pulsebeat.yourdomain.com,http://localhost:4141,http://localhost:5173
```


1. **Clone** this repository (or use your own compose file pointing at the image).
2. **Copy** environment defaults: `cp .env.example .env`
3. **Set** at least **`PULSEBEAT_JWT_SECRET`** (16+ characters). **Set** **`PULSEBEAT_ADMIN_PASSWORD`** if you want a known initial `admin` password; otherwise the first boot logs a **one-off random password**.
4. **Start**:

   ```bash
   docker compose up --build -d
   ```

5. Open **http://localhost:4141**, sign in, and add your first monitor.

Persistent data lives in **`./data`** on the host by default (`pulsebeat.db`). The image supports **linux/amd64** and **linux/arm64** (for example Raspberry Pi).

### Docker watch (live rebuild while you work)

If you want to keep Docker running and automatically rebuild on source changes:

```bash
docker compose up --build -d
docker compose watch
```

`docker compose watch` uses the `develop.watch` rules in `docker-compose.yml` and will rebuild/recreate the `pulsebeat` service when `client/`, `server/`, or build manifests change.

---

## Development

From the repository root:

```bash
npm install
npm run dev
```

- **UI (Vite):** [http://localhost:5173](http://localhost:5173) — proxies `/api` to the API (cookies are forwarded).
- **API:** [http://localhost:4141](http://localhost:4141)

Set **`PULSEBEAT_JWT_SECRET`** in `.env` (≥16 characters) for a stable secret. If you omit it in development, a built-in dev secret is used (**not** for production).

**First run (no users yet):** a default account is created:

- Username: **`admin`** (override with `PULSEBEAT_ADMIN_USER`)
- Password: **`changeme`** in development if `PULSEBEAT_ADMIN_PASSWORD` is unset; in production, if unset, a **random password is printed once** in the server logs — or set `PULSEBEAT_ADMIN_PASSWORD` in `.env` explicitly.

Production-style local run:

```bash
npm run build
npm run start
```

Then open [http://localhost:4141](http://localhost:4141) and sign in.

---

## Behind a reverse proxy or custom domain

If the browser origin and API origin differ, or you see **Content-Security-Policy** / **connect-src** issues, set **`PULSEBEAT_ALLOWED_ORIGINS`** to a comma-separated list of full origins (scheme + host, no path), e.g. `https://pulsebeat.example.com`. That feeds **CSP `connect-src`** and **credentialed CORS** for `/api`. If another layer injects a stricter CSP, adjust it there — Pulsebeat cannot override headers added in front of the app.

---

## Versioning and changelog

- Canonical changelog: **`CHANGELOG.md`** at the repo root.
- Copies are synced to **`client/public/`** and **`server/`** when you run `npm run dev`, `npm run build`, or `npm run sync-changelog`.
- For releases, bump **`version`** in the root **`package.json`**, **`client/package.json`**, and **`server/package.json`** together, then add a new section to **`CHANGELOG.md`**.

---

## Licence

See [LICENSE](LICENSE).

---

## Support

If you find Aura useful, consider buying me a coffee.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/xykheel)
