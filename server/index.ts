import { getPasswordProtectionEnabled } from './db.js';
import crypto from 'crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { buildHelmetOptions, corsSafelistMiddleware } from './allowedOrigins.js';
import authRouter from './routes/auth.js';
import monitorsRouter from './routes/monitors.js';
import notificationsRouter from './routes/notifications.js';
import summaryRouter from './routes/summary.js';
import settingsRouter from './routes/settings.js';
import tagsRouter from './routes/tags.js';
import maintenanceRouter from './routes/maintenance.js';
import { attachUserFromJwt, requireAuth } from './middleware/jwtAuth.js';
import { rescheduleAll, startPruneJob } from './checker.js';
import { readAppInfo } from './readAppInfo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 4141;

const staticCandidates = [
  process.env.PULSEBEAT_STATIC_DIR,
  path.join(__dirname, 'public'),
  path.join(__dirname, '../client/dist'),
].filter(Boolean) as string[];

function resolveStaticDir(): string | null {
  for (const dir of staticCandidates) {
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

/** 128-bit nonce, base64 (CSP nonces should be unguessable; paired with injected `nonce` on `<script>` in SPA shell). */
function cspNonceMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

function readIndexHtml(staticDir: string): string {
  return fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
}

/** Add `nonce` to `<script>` open tags so `script-src` can allow the SPA bootstrap without `'unsafe-inline'`. */
function injectScriptNonces(html: string, nonce: string): string {
  return html.replace(/<script(\s)(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"$1`);
}

app.use(cspNonceMiddleware);
app.use(corsSafelistMiddleware);
app.use(helmet(buildHelmetOptions()));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/auth/status', (_req: Request, res: Response) => {
  res.json({ passwordRequired: getPasswordProtectionEnabled() });
});

app.use('/api', attachUserFromJwt);
app.use('/api/auth', authRouter);

app.get('/api/app-info', requireAuth, (_req: Request, res: Response) => {
  try {
    res.json(readAppInfo());
  } catch {
    res.status(500).json({ error: 'Could not load app information' });
  }
});

app.use('/api/summary', requireAuth, summaryRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.use('/api/monitors', requireAuth, monitorsRouter);
app.use('/api/tags', requireAuth, tagsRouter);
app.use('/api/maintenance-windows', requireAuth, maintenanceRouter);
app.use('/api/settings', requireAuth, settingsRouter);

const staticDir = resolveStaticDir();
if (staticDir) {
  app.use(express.static(staticDir, { index: false, maxAge: '1d' }));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    const html = injectScriptNonces(readIndexHtml(staticDir), res.locals.cspNonce);
    res.type('html').send(html);
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  rescheduleAll();
  startPruneJob();
  if (process.env.NODE_ENV === 'production') {
    console.info(`Pulsebeat listening on http://0.0.0.0:${PORT}`);
  }
});
