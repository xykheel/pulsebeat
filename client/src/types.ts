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

export interface AppSettingsPublic {
  app_name: string;
  default_interval_sec: number;
  default_timeout_ms: number;
  default_retries: number;
  heartbeat_retention_days: number;
  incident_retention_days: number;
  password_protection_enabled: boolean;
  has_admin_password: boolean;
  db_size_bytes: number;
}

export interface AboutInfo {
  version: string;
  node_version: string;
  uptime_sec: number;
  github_url: string | null;
}

export interface ContainerMetricsPayload {
  source: 'cgroup_v2' | 'cgroup_v1_memory' | 'process';
  cpu_percent: number | null;
  memory_bytes: number | null;
  memory_limit_bytes: number | null;
  memory_percent: number | null;
  net_rx_bytes: number | null;
  net_tx_bytes: number | null;
  block_read_bytes: number | null;
  block_write_bytes: number | null;
  pids: number | null;
  pids_max: number | null;
  sampled_at_ms: number;
}

export interface EnrichedMonitor {
  id: number;
  name: string;
  type: MonitorType;
  url: string;
  interval: number;
  timeout: number;
  retries: number;
  active: number;
  check_ssl: number;
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
