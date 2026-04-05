import { Router, type Request, type Response } from 'express';
import { summaryStats, dashboardSummary } from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const base = summaryStats();
    const dash = dashboardSummary();
    res.json({
      ...base,
      up: dash.up,
      down: dash.down,
      paused: dash.paused,
      sparkline_up: dash.sparkline_up,
      sparkline_down: dash.sparkline_down,
      sparkline_paused: dash.sparkline_paused,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

export default router;
