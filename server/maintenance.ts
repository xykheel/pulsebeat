import { CronExpressionParser } from 'cron-parser';
import {
  listMaintenanceWindows,
  type MaintenanceWindowRow,
} from './db.js';

function windowMatchesMonitor(w: MaintenanceWindowRow, monitorId: number): boolean {
  return w.monitor_id == null || w.monitor_id === monitorId;
}

function recurringWindowActive(w: MaintenanceWindowRow, now: number): boolean {
  const cron = w.cron_expression?.trim();
  if (!cron) return false;
  const duration = w.ends_at - w.starts_at;
  if (duration <= 0) return false;
  const tz = w.timezone?.trim() || 'Australia/Sydney';
  try {
    const interval = CronExpressionParser.parse(cron, {
      tz,
      currentDate: new Date(now),
    });
    for (let i = 0; i < 48; i++) {
      const start = interval.prev().getTime();
      if (now >= start && now < start + duration) return true;
      if (start < now - duration - 14 * 24 * 3600 * 1000) break;
    }
  } catch {
    return false;
  }
  return false;
}

function windowActiveAt(w: MaintenanceWindowRow, monitorId: number, now: number): boolean {
  if (!w.active) return false;
  if (!windowMatchesMonitor(w, monitorId)) return false;
  if (!w.recurring) {
    return now >= w.starts_at && now < w.ends_at;
  }
  return recurringWindowActive(w, now);
}

export function isMonitorInActiveMaintenance(monitorId: number, now = Date.now()): boolean {
  for (const w of listMaintenanceWindows()) {
    if (windowActiveAt(w, monitorId, now)) return true;
  }
  return false;
}

export function listActiveMaintenanceWindows(now = Date.now()): MaintenanceWindowRow[] {
  return listMaintenanceWindows().filter((w) => {
    if (!w.active) return false;
    if (!w.recurring) return now >= w.starts_at && now < w.ends_at;
    return recurringWindowActive(w, now);
  });
}
