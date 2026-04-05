import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  getMergedSettings,
  setSetting,
  getDbFileSizeBytes,
  runRetentionPrune,
  findUserByUsername,
  updateUserPasswordHash,
} from '../db.js';
import { readAppInfo } from '../readAppInfo.js';
import { getContainerMetrics } from '../containerMetrics.js';

const router = Router();

const GITHUB_DEFAULT = process.env.PULSEBEAT_GITHUB_URL?.trim() || '';

function adminUsername(): string {
  return (process.env.PULSEBEAT_ADMIN_USER || 'admin').trim();
}

function parseIntSetting(v: string, fallback: number, min: number, max: number): number {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function publicSettingsPayload(merged: Record<string, string>) {
  return {
    app_name: merged.app_name || 'Pulsebeat',
    default_interval_sec: parseIntSetting(merged.default_interval_sec, 60, 5, 86400),
    default_timeout_ms: parseIntSetting(merged.default_timeout_ms, 10000, 1000, 120000),
    default_retries: parseIntSetting(merged.default_retries, 0, 0, 10),
    heartbeat_retention_days: parseIntSetting(merged.heartbeat_retention_days, 30, 1, 3650),
    incident_retention_days: parseIntSetting(merged.incident_retention_days, 90, 1, 3650),
    password_protection_enabled: merged.password_protection_enabled !== '0',
    has_admin_password: Boolean(merged.admin_password_hash?.length),
    db_size_bytes: getDbFileSizeBytes(),
    ssl_warning_days: parseIntSetting(merged.ssl_warning_days, 30, 1, 3650),
    ssl_critical_days: parseIntSetting(merged.ssl_critical_days, 7, 1, 3650),
    ssl_alert_self_signed: merged.ssl_alert_self_signed === '1',
    ssl_alert_tls_below_12: merged.ssl_alert_tls_below_12 !== '0',
  };
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const merged = getMergedSettings();
    res.json(publicSettingsPayload(merged));
  } catch {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;

    if (typeof body.app_name === 'string') {
      const name = body.app_name.trim().slice(0, 120);
      if (name) setSetting('app_name', name);
    }
    if (body.default_interval_sec !== undefined) {
      const n = parseIntSetting(String(body.default_interval_sec), 60, 5, 86400);
      setSetting('default_interval_sec', String(n));
    }
    if (body.default_timeout_ms !== undefined) {
      const n = parseIntSetting(String(body.default_timeout_ms), 10000, 1000, 120000);
      setSetting('default_timeout_ms', String(n));
    }
    if (body.default_retries !== undefined) {
      const n = parseIntSetting(String(body.default_retries), 0, 0, 10);
      setSetting('default_retries', String(n));
    }
    if (body.heartbeat_retention_days !== undefined) {
      const n = parseIntSetting(String(body.heartbeat_retention_days), 30, 1, 3650);
      setSetting('heartbeat_retention_days', String(n));
    }
    if (body.incident_retention_days !== undefined) {
      const n = parseIntSetting(String(body.incident_retention_days), 90, 1, 3650);
      setSetting('incident_retention_days', String(n));
    }
    if (body.ssl_warning_days !== undefined) {
      const n = parseIntSetting(String(body.ssl_warning_days), 30, 1, 3650);
      setSetting('ssl_warning_days', String(n));
    }
    if (body.ssl_critical_days !== undefined) {
      const n = parseIntSetting(String(body.ssl_critical_days), 7, 1, 3650);
      setSetting('ssl_critical_days', String(n));
    }
    if (body.ssl_alert_self_signed !== undefined) {
      const on = body.ssl_alert_self_signed === true || body.ssl_alert_self_signed === 1;
      setSetting('ssl_alert_self_signed', on ? '1' : '0');
    }
    if (body.ssl_alert_tls_below_12 !== undefined) {
      const on = body.ssl_alert_tls_below_12 === true || body.ssl_alert_tls_below_12 === 1;
      setSetting('ssl_alert_tls_below_12', on ? '1' : '0');
    }
    if (body.password_protection_enabled !== undefined) {
      const on = body.password_protection_enabled === true || body.password_protection_enabled === 1;
      setSetting('password_protection_enabled', on ? '1' : '0');
    }
    if (typeof body.new_admin_password === 'string' && body.new_admin_password.length > 0) {
      const pwd = body.new_admin_password;
      if (pwd.length < 10) {
        return res.status(400).json({ error: 'New password must be at least 10 characters' });
      }
      if (pwd.length > 256) {
        return res.status(400).json({ error: 'New password is too long' });
      }
      const hash = bcrypt.hashSync(pwd, 12);
      setSetting('admin_password_hash', hash);
      const admin = findUserByUsername(adminUsername());
      if (admin) {
        updateUserPasswordHash(admin.id, hash);
      }
    }

    const next = getMergedSettings();
    res.json(publicSettingsPayload(next));
  } catch {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.post('/purge', (_req: Request, res: Response) => {
  try {
    const r = runRetentionPrune();
    const merged = getMergedSettings();
    res.json({
      heartbeats_deleted: r.heartbeats,
      incidents_deleted: r.incidents,
      ...publicSettingsPayload(merged),
    });
  } catch {
    res.status(500).json({ error: 'Purge failed' });
  }
});

router.get('/about', (_req: Request, res: Response) => {
  try {
    const info = readAppInfo();
    res.json({
      version: info.version,
      node_version: process.version,
      uptime_sec: Math.floor(process.uptime()),
      github_url: GITHUB_DEFAULT || null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load about information' });
  }
});

router.get('/container-stats', (_req: Request, res: Response) => {
  try {
    res.json(getContainerMetrics());
  } catch {
    res.status(500).json({ error: 'Failed to read container metrics' });
  }
});

export default router;
