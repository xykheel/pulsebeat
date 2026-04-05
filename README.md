# Pulsebeat

Self-hosted uptime monitoring with a dark, glass-style dashboard. Express serves the built React app and the REST API on **port 4141**. SQLite stores monitors, heartbeats, incidents, and notification configuration.

You **must sign in** to use the dashboard. Sessions use a **JWT** stored in an **httpOnly** cookie (and the same token can be sent as `Authorization: Bearer <jwt>` for scripts).

## Development

```bash
npm install
npm run dev
```

- UI (Vite): [http://localhost:5173](http://localhost:5173) — proxies `/api` to the API (cookies are forwarded)
- API: [http://localhost:4141](http://localhost:4141)

Set `PULSEBEAT_JWT_SECRET` in `.env` (at least 16 characters) for a stable secret; if you omit it in development, a built-in dev secret is used (not for production).

**First run:** a default user is created if the database has no users:

- Username: `admin` (override with `PULSEBEAT_ADMIN_USER`)
- Password: `changeme` in development if `PULSEBEAT_ADMIN_PASSWORD` is unset; in production a **random password is generated and printed once** in the server logs if `PULSEBEAT_ADMIN_PASSWORD` is unset — set `PULSEBEAT_ADMIN_PASSWORD` in `.env` to choose it explicitly.

Production-style run locally:

```bash
npm run build
npm run start
```

Open [http://localhost:4141](http://localhost:4141) and sign in.

## Docker

There is **one** service in Compose: the same Node process serves **both** the web UI (static files) and the **REST API** on port **4141**.

Create a `.env` next to `docker-compose.yml` (see `.env.example`). **Required:** `PULSEBEAT_JWT_SECRET` (min 16 characters). **Recommended:** `PULSEBEAT_ADMIN_PASSWORD` so the initial `admin` password is known; otherwise check container logs on first boot for a generated password.

```bash
docker compose up --build -d
```

`-d` runs containers in the background. Without it, Compose stays attached to the process (you will see **Attaching to …** and then log output); that is normal, not a freeze.

To follow logs: `docker compose logs -f`.

The database is stored under `./data` on the host (`pulsebeat.db`). The image installs build tools so `better-sqlite3` compiles on **ARM64** (e.g. Raspberry Pi) and **amd64**.

## Versioning and changelog

- Canonical changelog: **`CHANGELOG.md`** at the repo root (user-facing language).
- Copies are synced to **`client/public/CHANGELOG.md`** and **`server/CHANGELOG.md`** whenever you run `npm run dev` or `npm run build`, or manually: `npm run sync-changelog`.
- Bump **`version`** in the root `package.json`, `client/package.json`, and `server/package.json` together when you release, then add a new section to **`CHANGELOG.md`**.

## Licence

See [LICENSE](LICENSE).
