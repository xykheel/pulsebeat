import type { EnrichedMonitor } from '../types';

/** Design-spec uptime colours (dark theme). */
export const UPTIME_GOOD = '#5DCAA5';
export const UPTIME_WARN = '#EF9F27';
export const UPTIME_DANGER = '#E24B4A';

export function uptimeColour(pct: number): 'good' | 'warn' | 'danger' {
  if (pct >= 99) return 'good';
  if (pct >= 95) return 'warn';
  return 'danger';
}

export function uptimeHex(pct: number): string {
  const b = uptimeColour(pct);
  if (b === 'good') return UPTIME_GOOD;
  if (b === 'warn') return UPTIME_WARN;
  return UPTIME_DANGER;
}

export function isStale(lastCheckAt: Date, intervalSeconds: number): boolean {
  return (Date.now() - lastCheckAt.getTime()) / 1000 > intervalSeconds * 1.5;
}

/** Treat high latency as a share of the configured timeout (no separate API field). */
export function slowThresholdMs(timeoutMs: number): number {
  return Math.floor(timeoutMs * 0.8);
}

export function uptime30d(m: EnrichedMonitor): number | null {
  const bars = m.daily_bars.slice(-30).filter((b) => b.pct != null);
  if (!bars.length) return null;
  return bars.reduce((acc, b) => acc + (b.pct ?? 0), 0) / bars.length;
}

export function isDegradedMonitor(m: EnrichedMonitor): boolean {
  if (!m.active) return false;
  if (m.latest?.status !== 1) return false;
  if (m.latest.checked_at && isStale(new Date(m.latest.checked_at), m.interval)) return true;
  const u = uptime30d(m);
  const slow = slowThresholdMs(m.timeout);
  const last5 = m.recent_checks_30.slice(-5);
  if (u != null && u < 99) return true;
  return last5.some((c) => c.status === 1 && c.latency_ms != null && c.latency_ms > slow);
}

export function parseHttpCode(msg: string | null): string {
  if (!msg) return '—';
  const match = msg.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? match[1] : '—';
}

/** Tooltip lines aligned to sparkline bars (18 slots, leading “No data” when history is short). */
export function buildSparklineTooltips(m: EnrichedMonitor): string[] {
  const raw = m.recent_checks_30.slice(-18);
  const pad = Math.max(0, 18 - raw.length);
  const out: string[] = [];
  for (let i = 0; i < pad; i++) {
    out.push('No data');
  }
  const latestAt = m.latest?.checked_at;
  for (let idxInRaw = 0; idxInRaw < raw.length; idxInRaw++) {
    const c = raw[idxInRaw];
    const ts = latestAt != null ? latestAt - (raw.length - 1 - idxInRaw) * m.interval * 1000 : Date.now();
    const formattedTimestamp = new Date(ts).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
    const st = c.status === 1 ? 'UP' : 'DOWN';
    const lat = c.latency_ms != null ? `${c.latency_ms}` : '—';
    const http = idxInRaw === raw.length - 1 ? parseHttpCode(m.latest?.message ?? null) : '—';
    out.push(`${formattedTimestamp} · ${st} · ${lat} ms · HTTP ${http}`);
  }
  return out;
}
