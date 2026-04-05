import { Router, type Request, type Response } from 'express';
import {
  listMaintenanceWindows,
  getMaintenanceWindow,
  createMaintenanceWindow,
  updateMaintenanceWindow,
  deleteMaintenanceWindow,
  db,
} from '../db.js';
import { listActiveMaintenanceWindows } from '../maintenance.js';

const router = Router();

router.get('/active', (_req: Request, res: Response) => {
  try {
    const windows = listActiveMaintenanceWindows();
    res.json({ windows });
  } catch {
    res.status(500).json({ error: 'Failed to load active maintenance windows' });
  }
});

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(listMaintenanceWindows());
  } catch {
    res.status(500).json({ error: 'Failed to list maintenance windows' });
  }
});

router.post('/', (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'name is required' });
  const starts_at = Number(body.starts_at);
  const ends_at = Number(body.ends_at);
  if (!Number.isFinite(starts_at) || !Number.isFinite(ends_at)) {
    return res.status(400).json({ error: 'starts_at and ends_at must be epoch milliseconds' });
  }
  if (ends_at <= starts_at) {
    return res.status(400).json({ error: 'ends_at must be after starts_at' });
  }
  const applyAll =
    body.apply_all === true ||
    body.all_monitors === true ||
    body.monitor_id === null ||
    body.monitor_id === 'all';
  const idsRaw = Array.isArray(body.monitor_ids) ? body.monitor_ids : null;
  const monitorIds = idsRaw
    ? idsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : null;

  let targets: (number | null)[] = [];
  if (applyAll) {
    targets = [null];
  } else if (monitorIds && monitorIds.length > 0) {
    targets = [...new Set(monitorIds)];
  } else if (body.monitor_id !== undefined && body.monitor_id !== null && body.monitor_id !== 'all') {
    const mid = Number(body.monitor_id);
    if (!Number.isFinite(mid)) return res.status(400).json({ error: 'Invalid monitor_id' });
    targets = [mid];
  } else {
    return res.status(400).json({ error: 'Select at least one monitor, or all monitors' });
  }

  const recurring = body.recurring === true || body.recurring === 1;
  const cron_expression =
    typeof body.cron_expression === 'string' && body.cron_expression.trim()
      ? body.cron_expression.trim()
      : null;
  if (recurring && !cron_expression) {
    return res.status(400).json({ error: 'cron_expression is required when recurring is enabled' });
  }
  const timezone =
    typeof body.timezone === 'string' && body.timezone.trim()
      ? body.timezone.trim()
      : 'Australia/Sydney';
  const active = body.active === undefined ? 1 : body.active === true || body.active === 1 ? 1 : 0;
  const recurringNum = recurring ? 1 : 0;
  try {
    const created = db.transaction(() => {
      const rows = [];
      for (const monitor_id of targets) {
        rows.push(
          createMaintenanceWindow({
            name,
            monitor_id,
            starts_at,
            ends_at,
            recurring: recurringNum,
            cron_expression,
            timezone,
            active,
          })
        );
      }
      return rows;
    })();
    res.status(201).json(created.length === 1 ? created[0] : { windows: created });
  } catch {
    res.status(500).json({ error: 'Failed to create maintenance window' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const ex = getMaintenanceWindow(id);
  if (!ex) return res.status(404).json({ error: 'Not found' });
  const body = (req.body || {}) as Record<string, unknown>;
  const patch: Parameters<typeof updateMaintenanceWindow>[1] = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (body.starts_at !== undefined) patch.starts_at = Number(body.starts_at);
  if (body.ends_at !== undefined) patch.ends_at = Number(body.ends_at);
  if (body.recurring !== undefined) {
    patch.recurring = body.recurring === true || body.recurring === 1 ? 1 : 0;
  }
  if (body.cron_expression !== undefined) {
    patch.cron_expression =
      typeof body.cron_expression === 'string' && body.cron_expression.trim()
        ? body.cron_expression.trim()
        : null;
  }
  if (typeof body.timezone === 'string') patch.timezone = body.timezone;
  if (body.active !== undefined) {
    patch.active = body.active === true || body.active === 1 ? 1 : 0;
  }
  if (body.monitor_id === null || body.monitor_id === 'all') {
    patch.monitor_id = null;
  } else if (body.monitor_id !== undefined) {
    const mid = Number(body.monitor_id);
    if (!Number.isFinite(mid)) return res.status(400).json({ error: 'Invalid monitor_id' });
    patch.monitor_id = mid;
  }
  if (
    patch.starts_at !== undefined &&
    patch.ends_at !== undefined &&
    patch.ends_at <= patch.starts_at
  ) {
    return res.status(400).json({ error: 'ends_at must be after starts_at' });
  }
  const nextStarts = patch.starts_at ?? ex.starts_at;
  const nextEnds = patch.ends_at ?? ex.ends_at;
  if (nextEnds <= nextStarts) {
    return res.status(400).json({ error: 'ends_at must be after starts_at' });
  }
  const nextRecurring = patch.recurring ?? ex.recurring === 1;
  const nextCron =
    patch.cron_expression !== undefined ? patch.cron_expression : ex.cron_expression;
  if (nextRecurring && !nextCron) {
    return res.status(400).json({ error: 'cron_expression is required when recurring is enabled' });
  }
  try {
    const row = updateMaintenanceWindow(id, patch);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to update maintenance window' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const ok = deleteMaintenanceWindow(id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
