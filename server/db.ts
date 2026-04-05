import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

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

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: 'Pulsebeat',
  default_interval_sec: '60',
  default_timeout_ms: '10000',
  default_retries: '0',
  heartbeat_retention_days: '30',
  incident_retention_days: '90',
  password_protection_enabled: '1',
  admin_password_hash: '',
  ssl_warning_days: '30',
  ssl_critical_days: '7',
  ssl_alert_self_signed: '0',
  ssl_alert_tls_below_12: '1',
};

function migrateSettingsAndSchema(): void {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    ins.run(k, v);
  }
  const cols = db.prepare('PRAGMA table_info(monitors)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'check_ssl')) {
    db.exec('ALTER TABLE monitors ADD COLUMN check_ssl INTEGER NOT NULL DEFAULT 0');
  }
}

migrateSettingsAndSchema();
runMigrations(db);

export function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (row) return row.value;
  return DEFAULT_SETTINGS[key] ?? '';
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getMergedSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}

export function getPasswordProtectionEnabled(): boolean {
  return getSetting('password_protection_enabled') !== '0';
}

function getHeartbeatRetentionDays(): number {
  const d = parseInt(getSetting('heartbeat_retention_days'), 10);
  return Number.isFinite(d) && d > 0 ? Math.min(3650, d) : 30;
}

function getIncidentRetentionDays(): number {
  const d = parseInt(getSetting('incident_retention_days'), 10);
  return Number.isFinite(d) && d > 0 ? Math.min(3650, d) : 90;
}

export function getDbFileSizeBytes(): number {
  try {
    return fs.statSync(dbPath).size;
  } catch {
    return 0;
  }
}

function pruneOldIncidentsResolvedBefore(cutoffMs: number): number {
  return db
    .prepare('DELETE FROM incidents WHERE resolved_at IS NOT NULL AND resolved_at < ?')
    .run(cutoffMs).changes;
}

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

function syncAdminPasswordHashFromUserIfEmpty(): void {
  const v = getSetting('admin_password_hash');
  if (v) return;
  const u = db
    .prepare('SELECT password_hash FROM users ORDER BY id ASC LIMIT 1')
    .get() as { password_hash: string } | undefined;
  if (u?.password_hash) {
    setSetting('admin_password_hash', u.password_hash);
  }
}

syncAdminPasswordHashFromUserIfEmpty();

interface UserRow {
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

export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns';

export interface MonitorRow {
  id: number;
  name: string;
  type: MonitorType;
  url: string;
  interval_sec: number;
  timeout_ms: number;
  retries: number;
  active: number;
  check_ssl: number;
  dns_config: string;
}

function rowToMonitor(raw: Record<string, unknown>): MonitorRow {
  return {
    id: Number(raw.id),
    name: String(raw.name),
    type: raw.type as MonitorType,
    url: String(raw.url),
    interval_sec: Number(raw.interval_sec),
    timeout_ms: Number(raw.timeout_ms),
    retries: Number(raw.retries),
    active: Number(raw.active),
    check_ssl: Number(raw.check_ssl ?? 0),
    dns_config: typeof raw.dns_config === 'string' ? raw.dns_config : '{}',
  };
}

export function listMonitors(): MonitorRow[] {
  const rows = db.prepare('SELECT * FROM monitors ORDER BY id ASC').all() as Record<string, unknown>[];
  return rows.map(rowToMonitor);
}

export function getMonitor(id: number): MonitorRow | undefined {
  const raw = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return raw ? rowToMonitor(raw) : undefined;
}

interface CreateMonitorInput {
  name: string;
  type: MonitorType;
  url: string;
  interval_sec: number;
  timeout_ms: number;
  retries: number;
  active: number;
  check_ssl?: number;
  dns_config?: string;
  notification_ids?: number[];
  tag_ids?: number[];
}

export function createMonitor(row: CreateMonitorInput): MonitorRow {
  const dnsJson =
    typeof row.dns_config === 'string' && row.dns_config.trim()
      ? row.dns_config.trim()
      : '{}';
  const stmt = db.prepare(`
    INSERT INTO monitors (name, type, url, interval_sec, timeout_ms, retries, active, check_ssl, dns_config)
    VALUES (@name, @type, @url, @interval_sec, @timeout_ms, @retries, @active, @check_ssl, @dns_config)
  `);
  const info = stmt.run({
    name: row.name,
    type: row.type,
    url: row.url,
    interval_sec: row.interval_sec,
    timeout_ms: row.timeout_ms,
    retries: row.retries,
    active: row.active ?? 1,
    check_ssl: row.check_ssl ? 1 : 0,
    dns_config: row.type === 'dns' ? dnsJson : '{}',
  });
  const id = Number(info.lastInsertRowid);
  if (Array.isArray(row.notification_ids)) {
    setMonitorNotifications(id, row.notification_ids);
  }
  if (Array.isArray(row.tag_ids)) {
    setMonitorTags(id, row.tag_ids);
  }
  return getMonitor(id)!;
}

interface UpdateMonitorInput {
  name?: string | null;
  type?: MonitorType | null;
  url?: string | null;
  interval_sec?: number | null;
  timeout_ms?: number | null;
  retries?: number | null;
  active?: number | null;
  check_ssl?: number | null;
  dns_config?: string | null;
  notification_ids?: number[];
  tag_ids?: number[];
}

export function updateMonitor(id: number, row: UpdateMonitorInput): MonitorRow | null {
  const existing = getMonitor(id);
  if (!existing) return null;
  const nextType = (row.type ?? existing.type) as MonitorType;
  let dnsCfg = (existing.dns_config && existing.dns_config.trim()) || '{}';
  if (nextType === 'dns') {
    if (typeof row.dns_config === 'string') {
      dnsCfg = row.dns_config.trim() || '{}';
    }
  } else {
    dnsCfg = '{}';
  }
  db.prepare(`
    UPDATE monitors SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      url = COALESCE(?, url),
      interval_sec = COALESCE(?, interval_sec),
      timeout_ms = COALESCE(?, timeout_ms),
      retries = COALESCE(?, retries),
      active = COALESCE(?, active),
      check_ssl = COALESCE(?, check_ssl),
      dns_config = ?
    WHERE id = ?
  `).run(
    row.name ?? null,
    row.type ?? null,
    row.url ?? null,
    row.interval_sec ?? null,
    row.timeout_ms ?? null,
    row.retries ?? null,
    row.active ?? null,
    row.check_ssl ?? null,
    dnsCfg,
    id
  );
  if (Array.isArray(row.notification_ids)) {
    setMonitorNotifications(id, row.notification_ids);
  }
  if (Array.isArray(row.tag_ids)) {
    setMonitorTags(id, row.tag_ids);
  }
  return getMonitor(id) ?? null;
}

export function deleteMonitor(id: number): boolean {
  const info = db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
  return info.changes > 0;
}

function setMonitorNotifications(monitorId: number, notificationIds: number[]): void {
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

interface NotificationRow {
  id: number;
  name: string;
  type: string;
  config: string;
  enabled: number;
}

interface NotificationWithConfig extends Omit<NotificationRow, 'config'> {
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

function pruneOldHeartbeats(maxAgeMs?: number): number {
  const ms =
    maxAgeMs ?? getHeartbeatRetentionDays() * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ms;
  return db.prepare('DELETE FROM heartbeats WHERE checked_at < ?').run(cutoff).changes;
}

export function runRetentionPrune(): { heartbeats: number; incidents: number } {
  const hb = pruneOldHeartbeats();
  const incCutoff = Date.now() - getIncidentRetentionDays() * 24 * 60 * 60 * 1000;
  const inc = pruneOldIncidentsResolvedBefore(incCutoff);
  return { heartbeats: hb, incidents: inc };
}

export function insertHeartbeat(
  monitorId: number,
  status: boolean,
  latencyMs: number | null,
  message: string | null,
  resolvedValue: string | null = null,
  maintenanceFlag = 0
): number {
  const checkedAt = Date.now();
  db.prepare(
    `INSERT INTO heartbeats (monitor_id, status, latency_ms, message, checked_at, resolved_value, maintenance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    monitorId,
    status ? 1 : 0,
    latencyMs ?? null,
    message ?? null,
    checkedAt,
    resolvedValue,
    maintenanceFlag ? 1 : 0
  );
  return checkedAt;
}

interface HeartbeatRow {
  id: number;
  monitor_id: number;
  status: number;
  latency_ms: number | null;
  message: string | null;
  checked_at: number;
  resolved_value: string | null;
  maintenance: number;
}

export function getHeartbeats(monitorId: number, limit = 500): HeartbeatRow[] {
  return db
    .prepare(
      `SELECT * FROM heartbeats WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`
    )
    .all(monitorId, limit) as HeartbeatRow[];
}

export function getHeartbeatsInRange(
  monitorId: number,
  fromMs: number,
  toMs: number,
  limit = 5000
): HeartbeatRow[] {
  return db
    .prepare(
      `SELECT * FROM heartbeats WHERE monitor_id = ? AND checked_at >= ? AND checked_at <= ? ORDER BY checked_at DESC LIMIT ?`
    )
    .all(monitorId, fromMs, toMs, limit) as HeartbeatRow[];
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

interface IncidentRow {
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

/** Incidents that overlap the window [fromMs, toMs] (inclusive). */
export function getIncidentsOverlappingRange(
  monitorId: number,
  fromMs: number,
  toMs: number,
  limit = 200
): IncidentRow[] {
  return db
    .prepare(
      `SELECT * FROM incidents WHERE monitor_id = ?
       AND started_at <= ? AND (resolved_at IS NULL OR resolved_at >= ?)
       ORDER BY started_at DESC LIMIT ?`
    )
    .all(monitorId, toMs, fromMs, limit) as IncidentRow[];
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

interface CreateNotificationInput {
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

interface UpdateNotificationInput {
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

interface SummaryStats {
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

interface DashboardSummaryPayload {
  up: number;
  down: number;
  paused: number;
  sparkline_up: number[];
  sparkline_down: number[];
  sparkline_paused: number[];
}

export function dashboardSummary(): DashboardSummaryPayload {
  const monitors = listMonitors();
  const pausedCount = monitors.filter((m) => !m.active).length;
  const activeMons = monitors.filter((m) => m.active);
  let up = 0;
  let down = 0;
  for (const m of activeMons) {
    const latest = getLatestHeartbeat(m.id);
    if (latest && latest.status === 1) up += 1;
    else down += 1;
  }
  const hourMs = 3600 * 1000;
  const start = Date.now() - 24 * hourMs;
  const allHb = db
    .prepare(
      `SELECT monitor_id, checked_at, status FROM heartbeats WHERE checked_at > ? ORDER BY monitor_id ASC, checked_at ASC`
    )
    .all(start) as { monitor_id: number; checked_at: number; status: number }[];
  const byMonitor = new Map<number, { checked_at: number; status: number }[]>();
  for (const row of allHb) {
    const arr = byMonitor.get(row.monitor_id) ?? [];
    arr.push(row);
    byMonitor.set(row.monitor_id, arr);
  }
  const stmtBefore = db.prepare(
    `SELECT status FROM heartbeats WHERE monitor_id = ? AND checked_at <= ? ORDER BY checked_at DESC LIMIT 1`
  );
  const beforeStatus = new Map<number, number | null>();
  for (const m of monitors) {
    const r = stmtBefore.get(m.id, start) as { status: number } | undefined;
    beforeStatus.set(m.id, r ? r.status : null);
  }
  const seriesByMonitor = new Map<number, (number | null)[]>();
  for (const m of monitors) {
    const arr = byMonitor.get(m.id) ?? [];
    let idx = 0;
    let last: number | null = beforeStatus.get(m.id) ?? null;
    const series: (number | null)[] = [];
    for (let i = 0; i < 24; i++) {
      const tEnd = start + (i + 1) * hourMs;
      while (idx < arr.length && arr[idx].checked_at <= tEnd) {
        last = arr[idx].status;
        idx += 1;
      }
      series.push(last);
    }
    seriesByMonitor.set(m.id, series);
  }
  const sparkline_up: number[] = [];
  const sparkline_down: number[] = [];
  const sparkline_paused: number[] = [];
  for (let i = 0; i < 24; i++) {
    let u = 0;
    let d = 0;
    for (const m of monitors) {
      if (!m.active) continue;
      const st = seriesByMonitor.get(m.id)?.[i];
      if (st === 1) u += 1;
      else if (st === 0) d += 1;
      else d += 1;
    }
    sparkline_up.push(u);
    sparkline_down.push(d);
    sparkline_paused.push(pausedCount);
  }
  return {
    up,
    down,
    paused: pausedCount,
    sparkline_up,
    sparkline_down,
    sparkline_paused,
  };
}

export interface TagRow {
  id: number;
  name: string;
  color: string;
}

export function listTags(): TagRow[] {
  return db.prepare('SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE ASC').all() as TagRow[];
}

function getTag(id: number): TagRow | undefined {
  return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(id) as TagRow | undefined;
}

export function createTag(name: string, color: string): TagRow | null {
  const n = name.trim().slice(0, 80);
  if (!n) return null;
  const c = /^#[0-9A-Fa-f]{6}$/.test(color.trim()) ? color.trim() : '#6366f1';
  try {
    const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(n, c);
    return getTag(Number(info.lastInsertRowid)) ?? null;
  } catch {
    return null;
  }
}

export function updateTag(id: number, name: string | null, color: string | null): TagRow | null {
  const existing = getTag(id);
  if (!existing) return null;
  const n = name != null ? name.trim().slice(0, 80) : null;
  let c: string | null = null;
  if (color != null) {
    const t = color.trim();
    c = /^#[0-9A-Fa-f]{6}$/.test(t) ? t : existing.color;
  }
  try {
    db.prepare(
      `
      UPDATE tags SET
        name = COALESCE(?, name),
        color = COALESCE(?, color)
      WHERE id = ?
    `
    ).run(n, c, id);
  } catch {
    return null;
  }
  return getTag(id) ?? null;
}

export function deleteTag(id: number): boolean {
  const r = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return r.changes > 0;
}

export function setMonitorTags(monitorId: number, tagIds: number[]): void {
  db.prepare('DELETE FROM monitor_tags WHERE monitor_id = ?').run(monitorId);
  const ins = db.prepare('INSERT INTO monitor_tags (monitor_id, tag_id) VALUES (?, ?)');
  const tx = db.transaction((ids: number[]) => {
    for (const tid of ids) {
      ins.run(monitorId, Number(tid));
    }
  });
  tx(tagIds.map(Number).filter((x) => !Number.isNaN(x)));
}

export function getTagsForMonitor(monitorId: number): TagRow[] {
  return db
    .prepare(
      `SELECT t.id, t.name, t.color FROM tags t
       INNER JOIN monitor_tags mt ON mt.tag_id = t.id
       WHERE mt.monitor_id = ?
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .all(monitorId) as TagRow[];
}

export interface MaintenanceWindowRow {
  id: number;
  name: string;
  monitor_id: number | null;
  starts_at: number;
  ends_at: number;
  recurring: number;
  cron_expression: string | null;
  timezone: string;
  active: number;
}

export function listMaintenanceWindows(): MaintenanceWindowRow[] {
  return db
    .prepare('SELECT * FROM maintenance_windows ORDER BY starts_at DESC')
    .all() as MaintenanceWindowRow[];
}

export function getMaintenanceWindow(id: number): MaintenanceWindowRow | undefined {
  return db
    .prepare('SELECT * FROM maintenance_windows WHERE id = ?')
    .get(id) as MaintenanceWindowRow | undefined;
}

interface MaintenanceWindowInput {
  name: string;
  monitor_id: number | null;
  starts_at: number;
  ends_at: number;
  /** 1 or 0 */
  recurring: number;
  cron_expression: string | null;
  timezone: string;
  /** 1 or 0 */
  active: number;
}

export function createMaintenanceWindow(row: MaintenanceWindowInput): MaintenanceWindowRow {
  const info = db
    .prepare(
      `INSERT INTO maintenance_windows (name, monitor_id, starts_at, ends_at, recurring, cron_expression, timezone, active)
       VALUES (@name, @monitor_id, @starts_at, @ends_at, @recurring, @cron_expression, @timezone, @active)`
    )
    .run({
      name: row.name.trim().slice(0, 120),
      monitor_id: row.monitor_id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      recurring: row.recurring ? 1 : 0,
      cron_expression: row.cron_expression?.trim() ? row.cron_expression.trim() : null,
      timezone: row.timezone?.trim() || 'Australia/Sydney',
      active: row.active ? 1 : 0,
    });
  return getMaintenanceWindow(Number(info.lastInsertRowid))!;
}

export function updateMaintenanceWindow(
  id: number,
  row: Partial<MaintenanceWindowInput>
): MaintenanceWindowRow | null {
  const ex = getMaintenanceWindow(id);
  if (!ex) return null;
  const name = row.name !== undefined ? row.name.trim().slice(0, 120) : ex.name;
  const monitor_id = row.monitor_id !== undefined ? row.monitor_id : ex.monitor_id;
  const starts_at = row.starts_at !== undefined ? row.starts_at : ex.starts_at;
  const ends_at = row.ends_at !== undefined ? row.ends_at : ex.ends_at;
  const recurring = row.recurring !== undefined ? (row.recurring ? 1 : 0) : ex.recurring;
  const cron_expression =
    row.cron_expression !== undefined
      ? row.cron_expression?.trim()
        ? row.cron_expression.trim()
        : null
      : ex.cron_expression;
  const timezone = row.timezone !== undefined ? row.timezone.trim() || 'Australia/Sydney' : ex.timezone;
  const active = row.active !== undefined ? (row.active ? 1 : 0) : ex.active;
  db.prepare(
    `UPDATE maintenance_windows SET
      name = ?, monitor_id = ?, starts_at = ?, ends_at = ?, recurring = ?, cron_expression = ?, timezone = ?, active = ?
     WHERE id = ?`
  ).run(name, monitor_id, starts_at, ends_at, recurring, cron_expression, timezone, active, id);
  return getMaintenanceWindow(id) ?? null;
}

export function deleteMaintenanceWindow(id: number): boolean {
  return db.prepare('DELETE FROM maintenance_windows WHERE id = ?').run(id).changes > 0;
}

export interface SslCheckRow {
  id: number;
  monitor_id: number;
  checked_at: number;
  status: number;
  days_remaining: number | null;
  subject_cn: string | null;
  subject_alt_names: string | null;
  serial_number: string | null;
  sha256_fingerprint: string | null;
  tls_version: string | null;
  cipher_suite: string | null;
  chain_fully_trusted: number | null;
  self_signed: number | null;
  valid_from: number | null;
  valid_to: number | null;
  message: string | null;
}

export type SslCheckInsert = Omit<SslCheckRow, 'id'>;

export function insertSslCheck(row: SslCheckInsert): void {
  db.prepare(
    `INSERT INTO ssl_checks (
      monitor_id, checked_at, status, days_remaining, subject_cn, subject_alt_names, serial_number,
      sha256_fingerprint, tls_version, cipher_suite, chain_fully_trusted, self_signed, valid_from, valid_to, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.monitor_id,
    row.checked_at,
    row.status,
    row.days_remaining,
    row.subject_cn,
    row.subject_alt_names,
    row.serial_number,
    row.sha256_fingerprint,
    row.tls_version,
    row.cipher_suite,
    row.chain_fully_trusted,
    row.self_signed,
    row.valid_from,
    row.valid_to,
    row.message
  );
}

export function listSslChecks(monitorId: number, limit: number): SslCheckRow[] {
  return db
    .prepare(
      `SELECT * FROM ssl_checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`
    )
    .all(monitorId, limit) as SslCheckRow[];
}

export function getLatestSslCheck(monitorId: number): SslCheckRow | undefined {
  return db
    .prepare(`SELECT * FROM ssl_checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1`)
    .get(monitorId) as SslCheckRow | undefined;
}

export interface CheckBarPoint {
  status: number;
  latency_ms: number | null;
}

export function getRecentCheckBars(monitorId: number, n: number): CheckBarPoint[] {
  const rows = db
    .prepare(
      `SELECT status, latency_ms FROM heartbeats WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`
    )
    .all(monitorId, n) as { status: number; latency_ms: number | null }[];
  return rows.slice().reverse();
}

export { db };
