Release notes for Pulsebeat. Version numbers follow [Semantic Versioning](https://semver.org/).


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
