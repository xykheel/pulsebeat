import { Router, type Request, type Response } from 'express';
import { summaryStats } from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(summaryStats());
  } catch {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

export default router;
