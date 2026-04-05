import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { findUserByUsername, findUserById, updateUserPasswordHash } from '../db.js';
import { signUserToken, AUTH_COOKIE_NAME } from '../auth/tokens.js';

const router = Router();

const loginHits = new Map<string, number[]>();
function rateLimitLogin(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 40;
  const key = ip || 'unknown';
  let arr = loginHits.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  loginHits.set(key, arr);
  return true;
}

const passwordChangeHits = new Map<string, number[]>();
function rateLimitPasswordChange(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 20;
  const key = ip || 'unknown';
  let arr = passwordChangeHits.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  passwordChangeHits.set(key, arr);
  return true;
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

router.post('/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  if (!rateLimitLogin(ip)) {
    return res.status(429).json({ error: 'Too many login attempts' });
  }
  const { username, password } = (req.body || {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = findUserByUsername(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signUserToken({ id: user.id, username: user.username });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
  res.json({ ok: true, user: { id: user.id, username: user.username } });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ ok: true });
});

router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

router.put('/password', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const ip = req.ip || req.socket.remoteAddress || '';
  if (!rateLimitPasswordChange(ip)) {
    return res.status(429).json({ error: 'Too many password change attempts' });
  }
  const body = (req.body || {}) as { current_password?: unknown; new_password?: unknown };
  const current =
    typeof body.current_password === 'string' ? body.current_password : '';
  const next = typeof body.new_password === 'string' ? body.new_password : '';
  if (!current || !next) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (next.length < 10) {
    return res.status(400).json({ error: 'New password must be at least 10 characters' });
  }
  if (next.length > 256) {
    return res.status(400).json({ error: 'New password is too long' });
  }
  const user = findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!bcrypt.compareSync(current, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (bcrypt.compareSync(next, user.password_hash)) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }
  const hash = bcrypt.hashSync(next, 12);
  const ok = updateUserPasswordHash(user.id, hash);
  if (!ok) {
    return res.status(500).json({ error: 'Could not update password' });
  }
  res.json({ ok: true });
});

export default router;
