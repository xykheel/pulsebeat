import { execFile } from 'child_process';
import net from 'net';
import tls from 'tls';
import { URL } from 'url';
import { promisify } from 'util';
import {
  insertHeartbeat,
  getMonitor,
  listMonitors,
  openIncident,
  resolveOpenIncident,
  getLatestHeartbeat,
  runRetentionPrune,
  type MonitorRow,
} from './db.js';
import { notifyMonitorEvent } from './notifications/dispatch.js';

const execFileAsync = promisify(execFile);

const timers = new Map<number, ReturnType<typeof setInterval>>();

function parseTcpTarget(url: string): { host: string; port: number } {
  const s = url.trim();
  if (s.startsWith('tcp://')) {
    const u = new URL(s);
    return { host: u.hostname, port: Number(u.port) || 0 };
  }
  const idx = s.lastIndexOf(':');
  if (idx <= 0) return { host: s, port: 0 };
  const host = s.slice(0, idx).replace(/^\[|\]$/g, '');
  const port = Number(s.slice(idx + 1));
  return { host, port: Number.isFinite(port) ? port : 0 };
}

interface CheckResult {
  ok: boolean;
  latency: number | null;
  message: string;
}

function checkTcp(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    if (!host || !port) {
      resolve({ ok: false, latency: null, message: 'Invalid host:port' });
      return;
    }
    const socket = net.createConnection({ host, port }, () => {
      const latency = Date.now() - started;
      socket.destroy();
      resolve({ ok: true, latency, message: 'Connected' });
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, latency: null, message: 'TCP timeout' });
    });
    socket.on('error', (err: Error) => {
      resolve({ ok: false, latency: null, message: err.message || 'TCP error' });
    });
  });
}

async function checkPing(host: string, timeoutMs: number): Promise<CheckResult> {
  const waitSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const started = Date.now();
  try {
    const { stdout } = await execFileAsync('ping', ['-c', '1', '-W', String(waitSec), host], {
      timeout: timeoutMs + 2000,
      maxBuffer: 256 * 1024,
    });
    const latency = Date.now() - started;
    const m = stdout.toString().match(/time[=<]([\d.]+)\s*ms/i);
    const parsed = m ? Math.round(parseFloat(m[1])) : latency;
    return { ok: true, latency: parsed, message: 'Ping OK' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ping failed';
    return { ok: false, latency: null, message };
  }
}

function parseHttpsHostPort(rawUrl: string): { host: string; port: number } | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 443;
    if (!host || !Number.isFinite(port)) return null;
    return { host, port };
  } catch {
    return null;
  }
}

function checkTlsCertificate(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: true,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true) as
            | { valid_to?: string; subject?: { CN?: string } }
            | null
            | undefined;
          socket.destroy();
          const validToStr = cert?.valid_to;
          if (!validToStr || (typeof cert === 'object' && cert && Object.keys(cert).length === 0)) {
            resolve({ ok: false, latency: null, message: 'TLS: no certificate' });
            return;
          }
          const exp = new Date(validToStr);
          if (Number.isNaN(exp.getTime())) {
            resolve({ ok: false, latency: null, message: 'TLS: invalid certificate dates' });
            return;
          }
          const now = Date.now();
          if (exp.getTime() < now) {
            resolve({
              ok: false,
              latency: null,
              message: `TLS: certificate expired ${exp.toISOString().slice(0, 10)}`,
            });
            return;
          }
          const daysLeft = Math.floor((exp.getTime() - now) / (24 * 60 * 60 * 1000));
          const cn = cert?.subject?.CN ?? host;
          resolve({
            ok: true,
            latency: null,
            message: `TLS OK · CN ${String(cn)} · expires ${exp.toISOString().slice(0, 10)} (${daysLeft}d)`,
          });
        } catch (e: unknown) {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
          const msg = e instanceof Error ? e.message : 'TLS error';
          resolve({ ok: false, latency: null, message: `TLS: ${msg}` });
        }
      }
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ ok: false, latency: null, message: 'TLS handshake timeout' });
    });
    socket.on('error', (err: Error) => {
      resolve({ ok: false, latency: null, message: `TLS: ${err.message || 'error'}` });
    });
  });
}

async function checkHttp(
  url: string,
  timeoutMs: number,
  retries: number,
  validateTls: boolean
): Promise<CheckResult> {
  let lastMessage = 'Request failed';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: '*/*', 'User-Agent': 'Pulsebeat/1.0' },
      });
      clearTimeout(t);
      const latency = Date.now() - started;
      if (res.ok) {
        let msg = `HTTP ${res.status}`;
        if (validateTls) {
          const hp = parseHttpsHostPort(url);
          if (!hp) {
            return { ok: false, latency, message: `${msg} · TLS validation requires https:// URL` };
          }
          const tlsRes = await checkTlsCertificate(hp.host, hp.port, timeoutMs);
          if (!tlsRes.ok) {
            return { ok: false, latency, message: `${msg} · ${tlsRes.message}` };
          }
          msg = `${msg} · ${tlsRes.message}`;
        }
        return { ok: true, latency, message: msg };
      }
      lastMessage = `HTTP ${res.status}`;
    } catch (e: unknown) {
      clearTimeout(t);
      const name = e instanceof Error ? e.name : '';
      const msg = e instanceof Error ? e.message : 'HTTP error';
      lastMessage = name === 'AbortError' ? 'HTTP timeout' : msg;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return { ok: false, latency: null, message: lastMessage };
}

async function runCheck(monitor: MonitorRow): Promise<void> {
  const timeout = monitor.timeout_ms;
  const retries = monitor.retries ?? 0;
  let result: CheckResult;
  if (monitor.type === 'http') {
    const validateTls = monitor.check_ssl === 1;
    result = await checkHttp(monitor.url, timeout, retries, validateTls);
  } else if (monitor.type === 'tcp') {
    const { host, port } = parseTcpTarget(monitor.url);
    result = await checkTcp(host, port, timeout);
    for (let i = 0; !result.ok && i < retries; i++) {
      await new Promise((r) => setTimeout(r, 500));
      result = await checkTcp(host, port, timeout);
    }
  } else if (monitor.type === 'ping') {
    const host = monitor.url.replace(/^ping:\/\//, '').trim();
    result = await checkPing(host, timeout);
    for (let i = 0; !result.ok && i < retries; i++) {
      await new Promise((r) => setTimeout(r, 500));
      result = await checkPing(host, timeout);
    }
  } else {
    result = { ok: false, latency: null, message: 'Unknown monitor type' };
  }

  const prev = getLatestHeartbeat(monitor.id);
  const wasUp = prev ? prev.status === 1 : true;

  insertHeartbeat(monitor.id, result.ok, result.latency, result.message);

  if (wasUp && !result.ok) {
    openIncident(monitor.id, result.message);
    notifyMonitorEvent(monitor, 'down', result.message).catch(() => {});
  } else if (!wasUp && result.ok) {
    resolveOpenIncident(monitor.id);
    notifyMonitorEvent(monitor, 'up', result.message).catch(() => {});
  }
}

export function scheduleMonitor(monitor: MonitorRow): void {
  clearMonitorSchedule(monitor.id);
  if (!monitor.active) return;
  const ms = Math.max(5, Number(monitor.interval_sec) || 60) * 1000;
  const tick = async (): Promise<void> => {
    const fresh = getMonitor(monitor.id);
    if (!fresh || !fresh.active) return;
    try {
      await runCheck(fresh);
    } catch {
      insertHeartbeat(fresh.id, false, null, 'Checker error');
    }
  };
  setTimeout(tick, 1500);
  const id = setInterval(tick, ms);
  timers.set(monitor.id, id);
}

export function clearMonitorSchedule(monitorId: number): void {
  const id = timers.get(monitorId);
  if (id) {
    clearInterval(id);
    timers.delete(monitorId);
  }
}

export function rescheduleAll(): void {
  const all = listMonitors();
  for (const m of all) {
    if (m.active) scheduleMonitor(m);
    else clearMonitorSchedule(m.id);
  }
}

let pruneTimer: ReturnType<typeof setInterval> | undefined;
export function startPruneJob(): void {
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = setInterval(() => {
    try {
      runRetentionPrune();
    } catch {
      /* ignore */
    }
  }, 6 * 60 * 60 * 1000);
}
