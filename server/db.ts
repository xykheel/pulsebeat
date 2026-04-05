import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataDir = process.env.PULSEBEAT_DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = process.env.PULSEBEAT_DB_PATH || path.join(dataDir, 'pulsebeat.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('http','tcp','ping')),
    url TEXT NOT NULL,
    interval_sec INTEGER NOT NULL DEFAULT 60,
    timeout_ms INTEGER NOT NULL DEFAULT 10000,
    retries INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status INTEGER NOT NULL CHECK (status IN (0,1)),
    latency_ms INTEGER,
    message TEXT,
    checked_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_checked ON heartbeats(monitor_id, checked_at DESC);

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    resolved_at INTEGER,
    duration_sec INTEGER,
    cause TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS monitor_notifications (
    monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    PRIMARY KEY (monitor_id, notification_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function seedDefaultUser(): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (count > 0) return;
  const username = (process.env.PULSEBEAT_ADMIN_USER || 'admin').trim();
  let password = process.env.PULSEBEAT_ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      password = crypto.randomBytes(18).toString('base64url');
      console.warn(
        `[Pulsebeat] No PULSEBEAT_ADMIN_PASSWORD — created user "${username}" with random password (save it, then set PULSEBEAT_ADMIN_PASSWORD or change credentials):`
      );
      console.warn(password);
    } else {
      password = 'changeme';
    }
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    username,
    hash,
    Date.now()
  );
}

seedDefaultUser();

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare('SELECT id, username, password_hash FROM users WHERE lower(username) = lower(?)')
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return db
    .prepare('SELECT id, username, password_hash FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
}

export function updateUserPasswordHash(userId: number, passwordHash: string): boolean {
  const r = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  return r.changes > 0;
}

export interface MonitorRow {
  id: number;
  name: string;
  type: 'http' | 'tcp' | 'ping';
  url: string;
  interval_sec: number;
  timeout_ms: number;
  retries: number;
  active: number;
}

export function listMonitors(): MonitorRow[] {
  return db.prepare('SELECT * FROM monitors ORDER BY id ASC').all() as MonitorRow[];
}

export function getMonitor(id: number): MonitorRow | undefined {
  return db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as MonitorRow | undefined;
}

export interface CreateMonitorInput {
  name: string;
  type: 'http' | 'tcp' | 'ping';
  url: string;
  interval_sec: number;
  timeout_ms: number;
  retries: number;
  active: number;
  notification_ids?: number[];
}

export function createMonitor(row: CreateMonitorInput): MonitorRow {
  const stmt = db.prepare(`
    INSERT INTO monitors (name, type, url, interval_sec, timeout_ms, retries, active)
    VALUES (@name, @type, @url, @interval_sec, @timeout_ms, @retries, @active)
  `);
  const info = stmt.run({
    name: row.name,
    type: row.type,
    url: row.url,
    interval_sec: row.interval_sec,
    timeout_ms: row.timeout_ms,
    retries: row.retries,
    active: row.active ?? 1,
  });
  const id = Number(info.lastInsertRowid);
  if (Array.isArray(row.notification_ids)) {
    setMonitorNotifications(id, row.notification_ids);
  }
  return getMonitor(id)!;
}

export interface UpdateMonitorInput {
  name?: string | null;
  type?: 'http' | 'tcp' | 'ping' | null;
  url?: string | null;
  interval_sec?: number | null;
  timeout_ms?: number | null;
  retries?: number | null;
  active?: number | null;
  notification_ids?: number[];
}

export function updateMonitor(id: number, row: UpdateMonitorInput): MonitorRow | null {
  const existing = getMonitor(id);
  if (!existing) return null;
  db.prepare(`
    UPDATE monitors SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      url = COALESCE(?, url),
      interval_sec = COALESCE(?, interval_sec),
      timeout_ms = COALESCE(?, timeout_ms),
      retries = COALESCE(?, retries),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    row.name ?? null,
    row.type ?? null,
    row.url ?? null,
    row.interval_sec ?? null,
    row.timeout_ms ?? null,
    row.retries ?? null,
    row.active ?? null,
    id
  );
  if (Array.isArray(row.notification_ids)) {
    setMonitorNotifications(id, row.notification_ids);
  }
  return getMonitor(id) ?? null;
}

export function deleteMonitor(id: number): boolean {
  const info = db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
  return info.changes > 0;
}

export function setMonitorNotifications(monitorId: number, notificationIds: number[]): void {
  db.prepare('DELETE FROM monitor_notifications WHERE monitor_id = ?').run(monitorId);
  const ins = db.prepare(
    'INSERT INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)'
  );
  const tx = db.transaction((ids: number[]) => {
    for (const nid of ids) {
      ins.run(monitorId, Number(nid));
    }
  });
  tx(notificationIds.map(Number).filter((n) => !Number.isNaN(n)));
}

export function getMonitorNotificationIds(monitorId: number): number[] {
  const rows = db
    .prepare('SELECT notification_id FROM monitor_notifications WHERE monitor_id = ?')
    .all(monitorId) as { notification_id: number }[];
  return rows.map((r) => r.notification_id);
}

export interface NotificationRow {
  id: number;
  name: string;
  type: string;
  config: string;
  enabled: number;
}

export interface NotificationWithConfig extends Omit<NotificationRow, 'config'> {
  config: Record<string, unknown>;
}

export function getEnabledNotificationsForMonitor(monitorId: number): NotificationWithConfig[] {
  const rows = db
    .prepare(
      `SELECT n.* FROM notifications n
       INNER JOIN monitor_notifications mn ON mn.notification_id = n.id
       WHERE mn.monitor_id = ? AND n.enabled = 1`
    )
    .all(monitorId) as NotificationRow[];
  return rows.map(parseConfigRow);
}

export function pruneOldHeartbeats(maxAgeMs = 120 * 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare('DELETE FROM heartbeats WHERE checked_at < ?').run(cutoff).changes;
}

export function insertHeartbeat(
  monitorId: number,
  status: boolean,
  latencyMs: number | null,
  message: string | null
): number {
  const checkedAt = Date.now();
  db.prepare(
    `INSERT INTO heartbeats (monitor_id, status, latency_ms, message, checked_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(monitorId, status ? 1 : 0, latencyMs ?? null, message ?? null, checkedAt);
  return checkedAt;
}

export interface HeartbeatRow {
  id: number;
  monitor_id: number;
  status: number;
  latency_ms: number | null;
  message: string | null;
  checked_at: number;
}

export function getHeartbeats(monitorId: number, limit = 500): HeartbeatRow[] {
  return db
    .prepare(
      `SELECT * FROM heartbeats WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`
    )
    .all(monitorId, limit) as HeartbeatRow[];
}

export function getLatestHeartbeat(monitorId: number): HeartbeatRow | undefined {
  return db
    .prepare(
      `SELECT * FROM heartbeats WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1`
    )
    .get(monitorId) as HeartbeatRow | undefined;
}

export function openIncident(monitorId: number, cause: string | null): void {
  const startedAt = Date.now();
  db.prepare(
    `INSERT INTO incidents (monitor_id, started_at, resolved_at, duration_sec, cause)
     VALUES (?, ?, NULL, NULL, ?)`
  ).run(monitorId, startedAt, cause ?? null);
}

export interface IncidentRow {
  id: number;
  monitor_id: number;
  started_at: number;
  resolved_at: number | null;
  duration_sec: number | null;
  cause: string | null;
}

export function resolveOpenIncident(monitorId: number): IncidentRow | null {
  const row = db
    .prepare(
      `SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1`
    )
    .get(monitorId) as IncidentRow | undefined;
  if (!row) return null;
  const resolvedAt = Date.now();
  const durationSec = Math.max(0, Math.round((resolvedAt - row.started_at) / 1000));
  db.prepare(
    `UPDATE incidents SET resolved_at = ?, duration_sec = ? WHERE id = ?`
  ).run(resolvedAt, durationSec, row.id);
  return { ...row, resolved_at: resolvedAt, duration_sec: durationSec };
}

export function getIncidents(monitorId: number, limit = 100): IncidentRow[] {
  return db
    .prepare(
      `SELECT * FROM incidents WHERE monitor_id = ? ORDER BY started_at DESC LIMIT ?`
    )
    .all(monitorId, limit) as IncidentRow[];
}

export function listNotifications(): NotificationWithConfig[] {
  const rows = db.prepare('SELECT * FROM notifications ORDER BY id ASC').all() as NotificationRow[];
  return rows.map(parseConfigRow);
}

export function getNotification(id: number): NotificationWithConfig | null {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRow | undefined;
  return row ? parseConfigRow(row) : null;
}

function parseConfigRow(row: NotificationRow): NotificationWithConfig {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config || '{}') as Record<string, unknown>;
  } catch {
    config = {};
  }
  return { ...row, config };
}

export interface CreateNotificationInput {
  name: string;
  type: string;
  config: string | Record<string, unknown>;
  enabled: number;
}

export function createNotification(row: CreateNotificationInput): NotificationWithConfig | null {
  const stmt = db.prepare(`
    INSERT INTO notifications (name, type, config, enabled)
    VALUES (@name, @type, @config, @enabled)
  `);
  const info = stmt.run({
    name: row.name,
    type: row.type,
    config: typeof row.config === 'string' ? row.config : JSON.stringify(row.config ?? {}),
    enabled: row.enabled ?? 1,
  });
  return getNotification(Number(info.lastInsertRowid));
}

export interface UpdateNotificationInput {
  name?: string | null;
  type?: string | null;
  config?: string | Record<string, unknown> | null;
  enabled?: number | null;
}

export function updateNotification(id: number, row: UpdateNotificationInput): NotificationWithConfig | null {
  const existing = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
  if (!existing) return null;
  let configJson: string | null = null;
  if (row.config !== undefined) {
    configJson =
      typeof row.config === 'string' ? row.config : JSON.stringify(row.config);
  }
  db.prepare(`
    UPDATE notifications SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      config = COALESCE(?, config),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(row.name ?? null, row.type ?? null, configJson, row.enabled ?? null, id);
  return getNotification(id);
}

export function deleteNotification(id: number): boolean {
  const info = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  return info.changes > 0;
}

export function uptimePercent(monitorId: number, fromMs: number, toMs: number): number | null {
  const rows = db
    .prepare(
      `SELECT status FROM heartbeats WHERE monitor_id = ? AND checked_at >= ? AND checked_at <= ?`
    )
    .all(monitorId, fromMs, toMs) as { status: number }[];
  if (!rows.length) return null;
  const up = rows.filter((r) => r.status === 1).length;
  return (up / rows.length) * 100;
}

export interface DailyBar {
  day: number;
  pct: number | null;
}

export function dailyUptimeBars(monitorId: number, days = 90): DailyBar[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const start = now - days * dayMs;
  const rows = db
    .prepare(
      `SELECT checked_at, status FROM heartbeats WHERE monitor_id = ? AND checked_at >= ? ORDER BY checked_at ASC`
    )
    .all(monitorId, start) as { checked_at: number; status: number }[];
  const buckets: DailyBar[] = [];
  for (let d = 0; d < days; d++) {
    const bStart = start + d * dayMs;
    const bEnd = bStart + dayMs;
    const inBucket = rows.filter((r) => r.checked_at >= bStart && r.checked_at < bEnd);
    if (!inBucket.length) {
      buckets.push({ day: d, pct: null });
    } else {
      const up = inBucket.filter((r) => r.status === 1).length;
      buckets.push({ day: d, pct: (up / inBucket.length) * 100 });
    }
  }
  return buckets;
}

export function avgLatency(monitorId: number, fromMs: number): number | null {
  const row = db
    .prepare(
      `SELECT AVG(latency_ms) as a FROM heartbeats WHERE monitor_id = ? AND status = 1 AND checked_at >= ? AND latency_ms IS NOT NULL`
    )
    .get(monitorId, fromMs) as { a: number | null } | undefined;
  return row?.a != null ? Math.round(row.a) : null;
}

export interface SummaryStats {
  total: number;
  online: number;
  offline: number;
  avgResponseMs: number | null;
}

export function summaryStats(): SummaryStats {
  const monitors = listMonitors();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let online = 0;
  let offline = 0;
  let latSum = 0;
  let latCount = 0;
  for (const m of monitors) {
    const latest = getLatestHeartbeat(m.id);
    if (!latest) {
      offline += 1;
      continue;
    }
    if (latest.status === 1) online += 1;
    else offline += 1;
    const avg = avgLatency(m.id, dayAgo);
    if (avg != null) {
      latSum += avg;
      latCount += 1;
    }
  }
  return {
    total: monitors.length,
    online,
    offline,
    avgResponseMs: latCount ? Math.round(latSum / latCount) : null,
  };
}

export { db };
