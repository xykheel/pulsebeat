export interface AuthUser {
  id: number;
  username: string;
}

export interface MonitorLatest {
  status: number;
  latency_ms: number | null;
  message: string | null;
  checked_at: number;
  resolved_value: string | null;
  maintenance: number;
}

export interface DailyBar {
  day: number;
  pct: number | null;
}

export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns';

export interface TagRow {
  id: number;
  name: string;
  color: string;
}

export interface CheckBarPoint {
  status: number;
  latency_ms: number | null;
}

export interface DnsConfig {
  hostname?: string;
  expected_ip?: string;
  resolver?: string;
  record_type?: string;
}

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
  ssl_warning_days: number;
  ssl_critical_days: number;
  ssl_alert_self_signed: boolean;
  ssl_alert_tls_below_12: boolean;
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
  dns_config: Record<string, unknown>;
  notification_ids: number[];
  tag_ids: number[];
  tags: TagRow[];
  in_maintenance: boolean;
  latest: MonitorLatest | null;
  uptime_pct_90d: number | null;
  uptime_pct_24h: number | null;
  avg_latency_ms: number | null;
  daily_bars: DailyBar[];
  sparkline: (number | null)[];
  recent_checks_30: CheckBarPoint[];
}

export interface SummaryStats {
  total: number;
  online: number;
  offline: number;
  avgResponseMs: number | null;
  /** Active monitors currently up (same as online when all monitors are active). */
  up?: number;
  down?: number;
  paused?: number;
  sparkline_up?: number[];
  sparkline_down?: number[];
  sparkline_paused?: number[];
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
  resolved_value?: string | null;
  maintenance?: number;
}

export interface IncidentRow {
  id: number;
  monitor_id: number;
  started_at: number;
  resolved_at: number | null;
  duration_sec: number | null;
  cause: string | null;
}

export interface MaintenanceWindowRow {
  id: number;
  name: string;
  monitor_id: number | null;
  starts_at: number;
  ends_at: number;
  recurring: number;
  cron_expression: string | null;
  timezone: string;
  active: number;
}

export interface SslCheckRow {
  id: number;
  monitor_id: number;
  checked_at: number;
  status: number;
  days_remaining: number | null;
  subject_cn: string | null;
  subject_alt_names: string | null;
  serial_number: string | null;
  sha256_fingerprint: string | null;
  tls_version: string | null;
  cipher_suite: string | null;
  chain_fully_trusted: number | null;
  self_signed: number | null;
  valid_from: number | null;
  valid_to: number | null;
  message: string | null;
}
