import { getEnabledNotificationsForMonitor, getNotification, type MonitorRow } from '../db.js';
import { dispatchNotification, type NotificationConfig } from './providers.js';

function formatAlertTime(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDetailForBody(detail: string | undefined): string | null {
  if (!detail?.trim()) return null;
  const parts = detail.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return `Detail: ${detail.trim()}`;
  }
  const lines = parts.map((p) => {
    const lower = p.toLowerCase();
    if (/^https?:\s/i.test(p) || /^http\s+\d/.test(lower)) return `📶 ${p}`;
    if (lower.includes('tls')) return `🔒 ${p}`;
    if (lower.startsWith('cn ') || lower.includes(' subject')) return `📇 ${p}`;
    if (lower.includes('expir')) return `📅 ${p}`;
    return `▸ ${p}`;
  });
  return `Detail:\n${lines.join('\n')}`;
}

function buildLines(monitor: MonitorRow, event: 'down' | 'up', detail: string | undefined): { title: string; body: string } {
  const status = event === 'down' ? 'DOWN' : 'UP';
  const body = [
    `Monitor: ${monitor.name}`,
    `Type: ${monitor.type.toUpperCase()}`,
    `Target: ${monitor.url}`,
    formatDetailForBody(detail),
    `Time: ${formatAlertTime()}`,
  ]
    .filter(Boolean)
    .join('\n');
  const title = `Pulsebeat — ${status}: ${monitor.name}`;
  return { title, body };
}

export async function notifyMonitorEvent(
  monitor: MonitorRow,
  event: 'down' | 'up',
  detail: string | undefined
): Promise<PromiseSettledResult<unknown>[]> {
  const { title, body } = buildLines(monitor, event, detail);
  const list = getEnabledNotificationsForMonitor(monitor.id);
  const results = await Promise.allSettled(
    list.map((n) => dispatchNotification(n.type, n.config as NotificationConfig, title, body))
  );
  return results;
}

export async function notifySslAlert(monitor: MonitorRow, detail: string): Promise<PromiseSettledResult<unknown>[]> {
  const title = `Pulsebeat — SSL: ${monitor.name}`;
  const body = [
    `Monitor: ${monitor.name}`,
    `Type: ${monitor.type.toUpperCase()}`,
    `Target: ${monitor.url}`,
    formatDetailForBody(detail) ?? `Detail: ${detail}`,
    `Time: ${formatAlertTime()}`,
  ].join('\n');
  const list = getEnabledNotificationsForMonitor(monitor.id);
  return Promise.allSettled(
    list.map((n) => dispatchNotification(n.type, n.config as NotificationConfig, title, body))
  );
}

export async function sendTestNotification(notificationId: number): Promise<void> {
  const n = getNotification(notificationId);
  if (!n) throw new Error('Notification not found');
  const title = 'Pulsebeat test notification';
  const body =
    'This is a test alert from Pulsebeat. If you see this, the channel is configured correctly.';
  await dispatchNotification(n.type, n.config as NotificationConfig, title, body);
}
