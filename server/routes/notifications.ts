import { Router, type Request, type Response } from 'express';
import {
  listNotifications,
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
} from '../db.js';
import { NOTIFICATION_TYPES } from '../notifications/providers.js';
import { sendTestNotification } from '../notifications/dispatch.js';
import type { NotificationConfig } from '../notifications/providers.js';

const router = Router();

const testHits = new Map<string, number[]>();
function rateLimitTest(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const key = ip || 'unknown';
  let arr = testHits.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  testHits.set(key, arr);
  return true;
}

function normaliseConfig(type: string, config: unknown): NotificationConfig {
  if (!config || typeof config !== 'object') return {};
  const c = { ...(config as NotificationConfig) };
  if (type === 'webhook' && typeof c.headers === 'string' && String(c.headers).trim()) {
    try {
      c.headers = JSON.parse(String(c.headers)) as Record<string, string>;
    } catch {
      /* keep string, will fail at send time */
    }
  }
  return c;
}

router.get('/types', (_req: Request, res: Response) => {
  res.json([...NOTIFICATION_TYPES].sort());
});

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(listNotifications());
  } catch {
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

router.post('/', (req: Request, res: Response) => {
  const { name, type, config, enabled } = (req.body || {}) as {
    name?: unknown;
    type?: unknown;
    config?: unknown;
    enabled?: unknown;
  };
  if (!name || typeof name !== 'string' || typeof type !== 'string' || !NOTIFICATION_TYPES.includes(type)) {
    return res.status(400).json({ error: 'name and valid type required' });
  }
  try {
    const row = createNotification({
      name: name.trim(),
      type,
      config: normaliseConfig(type, config),
      enabled: enabled === false || enabled === 0 ? 0 : 1,
    });
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = getNotification(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, type, config, enabled } = (req.body || {}) as {
    name?: unknown;
    type?: unknown;
    config?: unknown;
    enabled?: unknown;
  };
  try {
    const nextType = typeof type === 'string' && NOTIFICATION_TYPES.includes(type) ? type : existing.type;
    const row = updateNotification(id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      type: typeof type === 'string' && NOTIFICATION_TYPES.includes(type) ? type : undefined,
      config: config !== undefined ? normaliseConfig(nextType, config) : undefined,
      enabled:
        enabled === undefined ? undefined : enabled === false || enabled === 0 ? 0 : 1,
    });
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const ok = deleteNotification(id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

router.post('/:id/test', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const ip = req.ip || req.socket.remoteAddress || '';
  if (!rateLimitTest(ip)) {
    return res.status(429).json({ error: 'Too many test requests' });
  }
  try {
    await sendTestNotification(id);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Test failed';
    res.status(400).json({ error: msg });
  }
});

export default router;
