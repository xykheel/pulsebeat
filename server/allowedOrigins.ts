import type { HelmetOptions } from 'helmet';
import type { NextFunction, Request, Response } from 'express';

const ENV_KEY = 'PULSEBEAT_ALLOWED_ORIGINS';

/**
 * Parse comma-separated absolute origins (e.g. https://pulsebeat.example.com).
 * Used for CORS (credentialed) and Content-Security-Policy connect-src.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const s = part.trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (u.pathname !== '/' || u.search || u.hash) continue;
      const origin = `${u.protocol}//${u.host}`;
      if (!seen.has(origin)) {
        seen.add(origin);
        out.push(origin);
      }
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

let cachedOrigins: string[] | undefined;
let cachedSet: ReadonlySet<string> | undefined;

function loadOrigins(): string[] {
  if (cachedOrigins === undefined) {
    cachedOrigins = parseAllowedOrigins(process.env[ENV_KEY]);
  }
  return cachedOrigins;
}

export function getAllowedOrigins(): readonly string[] {
  return loadOrigins();
}

export function getAllowedOriginSet(): ReadonlySet<string> {
  if (!cachedSet) {
    cachedSet = new Set(loadOrigins());
  }
  return cachedSet;
}

/** Add ws:// / wss:// counterparts for CSP connect-src. */
function connectSrcVariants(origins: readonly string[]): string[] {
  const set = new Set<string>();
  for (const o of origins) {
    set.add(o);
    try {
      const u = new URL(o);
      if (u.protocol === 'https:') set.add(`wss://${u.host}`);
      else if (u.protocol === 'http:') set.add(`ws://${u.host}`);
    } catch {
      /* ignore */
    }
  }
  return [...set];
}

export function buildHelmetOptions(): HelmetOptions {
  const extraConnect = connectSrcVariants(loadOrigins());
  const connectSrc = Array.from(new Set<string>(["'self'", ...extraConnect]));
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc,
      },
    },
    crossOriginEmbedderPolicy: false,
  };
}

/**
 * Credentialed CORS for browser clients when the UI and API share different origins.
 * Same-origin deployments do not send Origin; this middleware is a no-op then.
 */
export function corsSafelistMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowed = getAllowedOriginSet();
  const origin = req.headers.origin;

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.append('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS' && req.path.startsWith('/api') && origin && allowed.has(origin)) {
    const acrh = req.headers['access-control-request-headers'];
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      typeof acrh === 'string' && acrh.trim() ? acrh : 'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  next();
}
