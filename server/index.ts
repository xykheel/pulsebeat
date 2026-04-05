import './db.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import authRouter from './routes/auth.js';
import monitorsRouter from './routes/monitors.js';
import notificationsRouter from './routes/notifications.js';
import summaryRouter from './routes/summary.js';
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
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

const staticDir = resolveStaticDir();
if (staticDir) {
  app.use(express.static(staticDir, { index: false, maxAge: '1d' }));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticDir, 'index.html'));
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
