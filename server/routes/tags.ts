import { Router, type Request, type Response } from 'express';
import { listTags, createTag, updateTag, deleteTag } from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(listTags());
  } catch {
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

router.post('/', (req: Request, res: Response) => {
  const body = (req.body || {}) as { name?: string; color?: string };
  const name = typeof body.name === 'string' ? body.name : '';
  const color = typeof body.color === 'string' ? body.color : '#6366f1';
  const row = createTag(name, color);
  if (!row) return res.status(400).json({ error: 'Invalid tag name or duplicate' });
  res.status(201).json(row);
});

router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const body = (req.body || {}) as { name?: string; color?: string };
  const name = body.name !== undefined ? String(body.name) : null;
  const color = body.color !== undefined ? String(body.color) : null;
  const row = updateTag(id, name, color);
  if (!row) return res.status(400).json({ error: 'Not found or duplicate name' });
  res.json(row);
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const ok = deleteTag(id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
