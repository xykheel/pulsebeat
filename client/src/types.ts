export interface AuthUser {
  id: number;
  username: string;
}

export interface MonitorLatest {
  status: number;
  latency_ms: number | null;
  message: string | null;
  checked_at: number;
}

export interface DailyBar {
  day: number;
  pct: number | null;
}

export type MonitorType = 'http' | 'tcp' | 'ping';

export interface EnrichedMonitor {
  id: number;
  name: string;
  type: MonitorType;
  url: string;
  interval: number;
  timeout: number;
  retries: number;
  active: number;
  notification_ids: number[];
  latest: MonitorLatest | null;
  uptime_pct_90d: number | null;
  uptime_pct_24h: number | null;
  avg_latency_ms: number | null;
  daily_bars: DailyBar[];
  sparkline: (number | null)[];
}

export interface SummaryStats {
  total: number;
  online: number;
  offline: number;
  avgResponseMs: number | null;
}

export interface NotificationItem {
  id: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: number;
}

export interface HeartbeatPoint {
  id: number;
  monitor_id: number;
  status: number;
  latency_ms: number | null;
  message: string | null;
  checked_at: number;
}

export interface IncidentRow {
  id: number;
  monitor_id: number;
  started_at: number;
  resolved_at: number | null;
  duration_sec: number | null;
  cause: string | null;
}
