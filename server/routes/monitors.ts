import { Router, type Request, type Response } from 'express';
import {
  listMonitors,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  getHeartbeats,
  getHeartbeatsInRange,
  getIncidents,
  getIncidentsOverlappingRange,
  getLatestHeartbeat,
  getMonitorNotificationIds,
  uptimePercent,
  dailyUptimeBars,
  avgLatency,
  getMergedSettings,
  getTagsForMonitor,
  getRecentCheckBars,
  listSslChecks,
  setMonitorTags,
  type MonitorRow,
  type MonitorType,
  type DailyBar,
  type TagRow,
  type CheckBarPoint,
} from '../db.js';
import { scheduleMonitor, clearMonitorSchedule, checkMonitorNow } from '../checker.js';
import { isMonitorInActiveMaintenance } from '../maintenance.js';

const router = Router();

interface MonitorBody {
  name?: string;
  type?: string;
  url?: string;
  interval?: number;
  interval_sec?: number;
  timeout?: number;
  timeout_ms?: number;
  retries?: number;
  active?: boolean | number;
  check_ssl?: boolean | number;
  notification_ids?: number[];
  dns_config?: unknown;
  tag_ids?: number[];
}

interface NormalisedMonitor {
  name?: string;
  type?: MonitorType;
  url?: string;
  interval_sec?: number;
  timeout_ms?: number;
  retries?: number;
  active?: number;
  check_ssl?: number;
  notification_ids?: number[];
  dns_config?: string;
  tag_ids?: number[];
}

function serialiseDnsConfig(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === 'string') return input.trim() || '{}';
  if (input && typeof input === 'object') {
    return JSON.stringify(input);
  }
  return undefined;
}

function normaliseBody(body: unknown): NormalisedMonitor | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as MonitorBody;
  const interval = b.interval ?? b.interval_sec;
  const timeout = b.timeout ?? b.timeout_ms;
  const t = b.type;
  const type: MonitorType | undefined =
    t === 'http' || t === 'tcp' || t === 'ping' || t === 'dns' ? t : undefined;
  return {
    name: typeof b.name === 'string' ? b.name.trim() : undefined,
    type,
    url: typeof b.url === 'string' ? b.url.trim() : undefined,
    interval_sec:
      interval !== undefined ? Math.max(5, Math.min(86400, Number(interval) || 60)) : undefined,
    timeout_ms:
      timeout !== undefined ? Math.max(1000, Math.min(120000, Number(timeout) || 10000)) : undefined,
    retries:
      b.retries !== undefined ? Math.max(0, Math.min(10, Number(b.retries) || 0)) : undefined,
    active: b.active !== undefined ? (b.active ? 1 : 0) : undefined,
    check_ssl: b.check_ssl !== undefined ? (b.check_ssl ? 1 : 0) : undefined,
    notification_ids: Array.isArray(b.notification_ids) ? b.notification_ids : undefined,
    dns_config: serialiseDnsConfig(b.dns_config),
    tag_ids: Array.isArray(b.tag_ids) ? b.tag_ids : undefined,
  };
}

interface EnrichedMonitor {
  id: number;
  name: string;
  type: MonitorType;
  url: string;
  interval: number;
  timeout: number;
  retries: number;
  active: number;
  check_ssl: number;
  dns_config: Record<string, unknown>;
  notification_ids: number[];
  tag_ids: number[];
  tags: TagRow[];
  in_maintenance: boolean;
  latest: {
    status: number;
    latency_ms: number | null;
    message: string | null;
    checked_at: number;
    resolved_value: string | null;
    maintenance: number;
  } | null;
  uptime_pct_90d: number | null;
  uptime_pct_24h: number | null;
  avg_latency_ms: number | null;
  daily_bars: DailyBar[];
  sparkline: (number | null)[];
  recent_checks_30: CheckBarPoint[];
}

function parseDnsObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function enrichMonitor(m: MonitorRow): EnrichedMonitor {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const d90 = 90 * day;
  const latest = getLatestHeartbeat(m.id);
  const up90 = uptimePercent(m.id, now - d90, now);
  const up24 = uptimePercent(m.id, now - day, now);
  const avg = avgLatency(m.id, now - day);
  const bars = dailyUptimeBars(m.id, 90);
  const recent = getHeartbeats(m.id, 48)
    .reverse()
    .map((h) => (h.status === 1 && h.latency_ms != null ? h.latency_ms : null));
  const tags = getTagsForMonitor(m.id);
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    url: m.url,
    interval: m.interval_sec,
    timeout: m.timeout_ms,
    retries: m.retries,
    active: m.active,
    check_ssl: m.check_ssl ?? 0,
    dns_config: parseDnsObject(m.dns_config || '{}'),
    notification_ids: getMonitorNotificationIds(m.id),
    tag_ids: tags.map((t) => t.id),
    tags,
    in_maintenance: isMonitorInActiveMaintenance(m.id),
    latest: latest
      ? {
          status: latest.status,
          latency_ms: latest.latency_ms,
          message: latest.message,
          checked_at: latest.checked_at,
          resolved_value: latest.resolved_value ?? null,
          maintenance: latest.maintenance ?? 0,
        }
      : null,
    uptime_pct_90d: up90,
    uptime_pct_24h: up24,
    avg_latency_ms: avg,
    daily_bars: bars,
    sparkline: recent,
    recent_checks_30: getRecentCheckBars(m.id, 30),
  };
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = listMonitors();
    res.json(rows.map(enrichMonitor));
  } catch {
    res.status(500).json({ error: 'Failed to list monitors' });
  }
});

router.post('/', (req: Request, res: Response) => {
  const p = normaliseBody(req.body);
  if (!p?.name || !p.type || !p.url) {
    return res.status(400).json({ error: 'name, type, and url are required' });
  }
  if (p.type === 'dns' && !p.dns_config) {
    p.dns_config = '{}';
  }
  try {
    const defs = getMergedSettings();
    const di = parseInt(defs.default_interval_sec || '60', 10);
    const dt = parseInt(defs.default_timeout_ms || '10000', 10);
    const dr = parseInt(defs.default_retries || '0', 10);
    const row = createMonitor({
      name: p.name,
      type: p.type,
      url: p.url,
      interval_sec: p.interval_sec ?? (Number.isFinite(di) ? Math.min(86400, Math.max(5, di)) : 60),
      timeout_ms: p.timeout_ms ?? (Number.isFinite(dt) ? Math.min(120000, Math.max(1000, dt)) : 10000),
      retries: p.retries ?? (Number.isFinite(dr) ? Math.min(10, Math.max(0, dr)) : 0),
      active: p.active ?? 1,
      check_ssl: p.check_ssl ?? 0,
      dns_config: p.type === 'dns' ? p.dns_config ?? '{}' : undefined,
      notification_ids: p.notification_ids,
      tag_ids: p.tag_ids,
    });
    if (row.active) scheduleMonitor(row);
    else clearMonitorSchedule(row.id);
    res.status(201).json(enrichMonitor(row));
  } catch {
    res.status(500).json({ error: 'Failed to create monitor' });
  }
});

router.get('/:id/ssl-checks', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
  try {
    res.json(listSslChecks(id, limit));
  } catch {
    res.status(500).json({ error: 'Failed to load SSL checks' });
  }
});

router.get('/:id/heartbeats', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 500));
  const fromMs = Number(req.query.from);
  const toMs = Number(req.query.to);
  try {
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs <= toMs) {
      res.json(getHeartbeatsInRange(id, fromMs, toMs, limit));
    } else {
      res.json(getHeartbeats(id, limit));
    }
  } catch {
    res.status(500).json({ error: 'Failed to load heartbeats' });
  }
});

router.get('/:id/incidents', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const fromMs = Number(req.query.from);
  const toMs = Number(req.query.to);
  try {
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs <= toMs) {
      res.json(getIncidentsOverlappingRange(id, fromMs, toMs, Math.min(500, limit)));
    } else {
      res.json(getIncidents(id, limit));
    }
  } catch {
    res.status(500).json({ error: 'Failed to load incidents' });
  }
});

router.post('/:id/check', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  try {
    await checkMonitorNow(id);
    const m = getMonitor(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(enrichMonitor(m));
  } catch {
    res.status(500).json({ error: 'Check failed' });
  }
});

router.put('/:id/tags', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const body = (req.body || {}) as { tag_ids?: unknown };
  if (!Array.isArray(body.tag_ids)) {
    return res.status(400).json({ error: 'tag_ids array required' });
  }
  const tag_ids = body.tag_ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  try {
    setMonitorTags(id, tag_ids);
    const m = getMonitor(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(enrichMonitor(m));
  } catch {
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const m = getMonitor(id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json(enrichMonitor(m));
});

router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = getMonitor(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const p = normaliseBody(req.body);
  if (!p) return res.status(400).json({ error: 'Invalid body' });
  try {
    const row = updateMonitor(id, {
      name: p.name,
      type: p.type,
      url: p.url,
      interval_sec: p.interval_sec,
      timeout_ms: p.timeout_ms,
      retries: p.retries,
      active: p.active,
      check_ssl: p.check_ssl,
      dns_config: p.dns_config,
      notification_ids: p.notification_ids,
      tag_ids: p.tag_ids,
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.active) scheduleMonitor(row);
    else clearMonitorSchedule(row.id);
    res.json(enrichMonitor(row));
  } catch {
    res.status(500).json({ error: 'Failed to update monitor' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  clearMonitorSchedule(id);
  const ok = deleteMonitor(id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
