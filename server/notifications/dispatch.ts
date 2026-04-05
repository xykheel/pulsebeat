import { getEnabledNotificationsForMonitor, getNotification, type MonitorRow } from '../db.js';
import { dispatchNotification, type NotificationConfig } from './providers.js';

function buildLines(monitor: MonitorRow, event: 'down' | 'up', detail: string | undefined): { title: string; body: string } {
  const status = event === 'down' ? 'DOWN' : 'UP';
  const body = [
    `Monitor: ${monitor.name}`,
    `Type: ${monitor.type.toUpperCase()}`,
    `Target: ${monitor.url}`,
    detail ? `Detail: ${detail}` : null,
    `Time: ${new Date().toISOString()}`,
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

export async function sendTestNotification(notificationId: number): Promise<void> {
  const n = getNotification(notificationId);
  if (!n) throw new Error('Notification not found');
  const title = 'Pulsebeat test notification';
  const body =
    'This is a test alert from Pulsebeat. If you see this, the channel is configured correctly.';
  await dispatchNotification(n.type, n.config as NotificationConfig, title, body);
}
