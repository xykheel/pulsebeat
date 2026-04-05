import { Router, type Request, type Response } from 'express';
import {
  listMonitors,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  getHeartbeats,
  getIncidents,
  getLatestHeartbeat,
  getMonitorNotificationIds,
  uptimePercent,
  dailyUptimeBars,
  avgLatency,
  type MonitorRow,
  type DailyBar,
} from '../db.js';
import { scheduleMonitor, clearMonitorSchedule } from '../checker.js';

const router = Router();

type MonitorType = 'http' | 'tcp' | 'ping';

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
  notification_ids?: number[];
}

interface NormalisedMonitor {
  name?: string;
  type?: MonitorType;
  url?: string;
  interval_sec?: number;
  timeout_ms?: number;
  retries?: number;
  active?: number;
  notification_ids?: number[];
}

function normaliseBody(body: unknown): NormalisedMonitor | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as MonitorBody;
  const interval = b.interval ?? b.interval_sec;
  const timeout = b.timeout ?? b.timeout_ms;
  const t = b.type;
  const type: MonitorType | undefined =
    t === 'http' || t === 'tcp' || t === 'ping' ? t : undefined;
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
    notification_ids: Array.isArray(b.notification_ids) ? b.notification_ids : undefined,
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
  notification_ids: number[];
  latest: {
    status: number;
    latency_ms: number | null;
    message: string | null;
    checked_at: number;
  } | null;
  uptime_pct_90d: number | null;
  uptime_pct_24h: number | null;
  avg_latency_ms: number | null;
  daily_bars: DailyBar[];
  sparkline: (number | null)[];
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
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    url: m.url,
    interval: m.interval_sec,
    timeout: m.timeout_ms,
    retries: m.retries,
    active: m.active,
    notification_ids: getMonitorNotificationIds(m.id),
    latest: latest
      ? {
          status: latest.status,
          latency_ms: latest.latency_ms,
          message: latest.message,
          checked_at: latest.checked_at,
        }
      : null,
    uptime_pct_90d: up90,
    uptime_pct_24h: up24,
    avg_latency_ms: avg,
    daily_bars: bars,
    sparkline: recent,
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
  try {
    const row = createMonitor({
      name: p.name,
      type: p.type,
      url: p.url,
      interval_sec: p.interval_sec ?? 60,
      timeout_ms: p.timeout_ms ?? 10000,
      retries: p.retries ?? 0,
      active: p.active ?? 1,
      notification_ids: p.notification_ids,
    });
    if (row.active) scheduleMonitor(row);
    else clearMonitorSchedule(row.id);
    res.status(201).json(enrichMonitor(row));
  } catch {
    res.status(500).json({ error: 'Failed to create monitor' });
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
      notification_ids: p.notification_ids,
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

router.get('/:id/heartbeats', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 500));
  try {
    res.json(getHeartbeats(id, limit));
  } catch {
    res.status(500).json({ error: 'Failed to load heartbeats' });
  }
});

router.get('/:id/incidents', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!getMonitor(id)) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  try {
    res.json(getIncidents(id, limit));
  } catch {
    res.status(500).json({ error: 'Failed to load incidents' });
  }
});

export default router;
