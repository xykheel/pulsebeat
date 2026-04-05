import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, verifyUserToken } from '../auth/tokens.js';

export function attachUserFromJwt(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) token = auth.slice(7);
  }
  req.user = null;
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyUserToken(token);
    req.user = { id: Number(payload.sub), username: payload.username };
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}
