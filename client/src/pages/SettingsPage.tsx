import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SpeedIcon from '@mui/icons-material/Speed';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import type { AboutInfo, AppSettingsPublic, ContainerMetricsPayload } from '../types';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function formatMemoryRow(m: ContainerMetricsPayload): string {
  if (m.memory_bytes == null) return '—';
  const cur = formatBytes(m.memory_bytes);
  if (m.memory_limit_bytes != null && m.memory_percent != null) {
    return `${cur} / ${formatBytes(m.memory_limit_bytes)} (${m.memory_percent.toFixed(2)}%)`;
  }
  if (m.memory_limit_bytes != null) {
    return `${cur} / ${formatBytes(m.memory_limit_bytes)}`;
  }
  return `${cur} (no cgroup limit)`;
}

function formatNetRow(m: ContainerMetricsPayload): string {
  const rx = m.net_rx_bytes != null ? formatBytes(m.net_rx_bytes) : '—';
  const tx = m.net_tx_bytes != null ? formatBytes(m.net_tx_bytes) : '—';
  return `${rx} \u2193 · ${tx} \u2191`;
}

function formatBlockRow(m: ContainerMetricsPayload): string {
  const r = m.block_read_bytes != null ? formatBytes(m.block_read_bytes) : '—';
  const w = m.block_write_bytes != null ? formatBytes(m.block_write_bytes) : '—';
  return `${r} read · ${w} write`;
}

function formatPidsRow(m: ContainerMetricsPayload): string {
  if (m.pids == null) return '—';
  if (m.pids_max != null) return `${m.pids} / ${m.pids_max}`;
  return String(m.pids);
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        <Box sx={{ color: 'primary.main', display: 'flex', '& svg': { fontSize: '1.15rem' } }} aria-hidden>
          {icon}
        </Box>
        <Typography variant="body2" color="text.secondary" component="span">
          {label}
        </Typography>
      </Stack>
      <Typography variant="dataSmall" sx={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null);
  const [about, setAbout] = useState<AboutInfo | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [metrics, setMetrics] = useState<ContainerMetricsPayload | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [settingsTab, setSettingsTab] = useState(0);
  const [form, setForm] = useState({
    app_name: '',
    default_interval_sec: '60',
    default_timeout_ms: '10000',
    default_retries: '0',
    heartbeat_retention_days: '30',
    incident_retention_days: '90',
    ssl_warning_days: '30',
    ssl_critical_days: '7',
    ssl_alert_self_signed: false,
    ssl_alert_tls_below_12: true,
  });

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [s, a] = await Promise.all([
        apiGet<AppSettingsPublic>('/api/settings'),
        apiGet<AboutInfo>('/api/settings/about'),
      ]);
      setSettings(s);
      setAbout(a);
      setForm((f) => ({
        ...f,
        app_name: s.app_name,
        default_interval_sec: String(s.default_interval_sec),
        default_timeout_ms: String(s.default_timeout_ms),
        default_retries: String(s.default_retries),
        heartbeat_retention_days: String(s.heartbeat_retention_days),
        incident_retention_days: String(s.incident_retention_days),
        ssl_warning_days: String(s.ssl_warning_days ?? 30),
        ssl_critical_days: String(s.ssl_critical_days ?? 7),
        ssl_alert_self_signed: Boolean(s.ssl_alert_self_signed),
        ssl_alert_tls_below_12: s.ssl_alert_tls_below_12 !== false,
      }));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    async function fetchMetrics() {
      if (document.visibilityState !== 'visible') return;
      try {
        const m = await apiGet<ContainerMetricsPayload>('/api/settings/container-stats');
        setMetrics(m);
        setMetricsError('');
      } catch (e) {
        setMetricsError(e instanceof Error ? e.message : 'Failed to load metrics');
      }
    }
    void fetchMetrics();
    intervalId = setInterval(() => void fetchMetrics(), 3000);
    function onVis() {
      if (document.visibilityState === 'visible') void fetchMetrics();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  function applySettingsResponse(s: AppSettingsPublic) {
    setSettings(s);
    setForm((f) => ({
      ...f,
      app_name: s.app_name,
      default_interval_sec: String(s.default_interval_sec),
      default_timeout_ms: String(s.default_timeout_ms),
      default_retries: String(s.default_retries),
      heartbeat_retention_days: String(s.heartbeat_retention_days),
      incident_retention_days: String(s.incident_retention_days),
      ssl_warning_days: String(s.ssl_warning_days ?? 30),
      ssl_critical_days: String(s.ssl_critical_days ?? 7),
      ssl_alert_self_signed: Boolean(s.ssl_alert_self_signed),
      ssl_alert_tls_below_12: s.ssl_alert_tls_below_12 !== false,
    }));
    window.dispatchEvent(new CustomEvent('pulsebeat:settings-updated'));
  }

  async function saveGeneral() {
    setSaving(true);
    setError('');
    try {
      const s = await apiSend<AppSettingsPublic>('/api/settings', 'PUT', {
        app_name: form.app_name.trim(),
        default_interval_sec: Number(form.default_interval_sec),
        default_timeout_ms: Number(form.default_timeout_ms),
        default_retries: Number(form.default_retries),
      });
      if (s) applySettingsResponse(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveSsl() {
    setSaving(true);
    setError('');
    try {
      const s = await apiSend<AppSettingsPublic>('/api/settings', 'PUT', {
        ssl_warning_days: Number(form.ssl_warning_days),
        ssl_critical_days: Number(form.ssl_critical_days),
        ssl_alert_self_signed: form.ssl_alert_self_signed,
        ssl_alert_tls_below_12: form.ssl_alert_tls_below_12,
      });
      if (s) applySettingsResponse(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveRetention() {
    setSaving(true);
    setError('');
    try {
      const s = await apiSend<AppSettingsPublic>('/api/settings', 'PUT', {
        heartbeat_retention_days: Number(form.heartbeat_retention_days),
        incident_retention_days: Number(form.incident_retention_days),
      });
      if (s) applySettingsResponse(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function purgeNow() {
    if (
      !window.confirm(
        'Purge heartbeats and resolved incidents older than your retention settings? This cannot be undone.'
      )
    ) {
      return;
    }
    setPurging(true);
    setError('');
    try {
      const r = await apiSend<AppSettingsPublic & { heartbeats_deleted: number; incidents_deleted: number }>(
        '/api/settings/purge',
        'POST'
      );
      if (r) applySettingsResponse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purge failed');
    } finally {
      setPurging(false);
    }
  }

  return (
    <Box>
      <Box className="mb-4 flex flex-wrap items-center gap-2">
        <SettingsOutlinedIcon className="text-pb-primary text-[2rem] shrink-0" aria-hidden />
        <Typography variant="h4" component="h1" className="tracking-tight">
          Settings
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={settingsTab}
        onChange={(_, v) => setSettingsTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', minHeight: 44 },
        }}
      >
        <Tab label="General" id="settings-tab-0" aria-controls="settings-panel-0" />
        <Tab label="Data retention" id="settings-tab-1" aria-controls="settings-panel-1" />
        <Tab label="Self-monitoring" id="settings-tab-2" aria-controls="settings-panel-2" />
        <Tab label="SSL alerting" id="settings-tab-3" aria-controls="settings-panel-3" />
        <Tab label="About" id="settings-tab-4" aria-controls="settings-panel-4" />
      </Tabs>

      {settingsTab === 0 ? (
      <Stack spacing={2.5} role="tabpanel" id="settings-panel-0" aria-labelledby="settings-tab-0">
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            General
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Display name and defaults for new monitors.
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="App name"
              value={form.app_name}
              onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Default check interval (sec)"
                type="number"
                value={form.default_interval_sec}
                onChange={(e) => setForm((f) => ({ ...f, default_interval_sec: e.target.value }))}
                fullWidth
                inputProps={{ min: 5, max: 86400 }}
              />
              <TextField
                label="Default timeout (ms)"
                type="number"
                value={form.default_timeout_ms}
                onChange={(e) => setForm((f) => ({ ...f, default_timeout_ms: e.target.value }))}
                fullWidth
                inputProps={{ min: 1000, max: 120000 }}
              />
              <TextField
                label="Default retries"
                type="number"
                value={form.default_retries}
                onChange={(e) => setForm((f) => ({ ...f, default_retries: e.target.value }))}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Stack>
            <Button variant="contained" onClick={() => void saveGeneral()} disabled={saving}>
              Save general
            </Button>
          </Stack>
        </GlassCard>
      </Stack>
      ) : null}

      {settingsTab === 1 ? (
      <Stack spacing={2.5} role="tabpanel" id="settings-panel-1" aria-labelledby="settings-tab-1">
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            Data retention
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Heartbeats and resolved incidents are pruned automatically every few hours. Open incidents are kept
            until resolved.
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Heartbeat retention (days)"
              type="number"
              value={form.heartbeat_retention_days}
              onChange={(e) => setForm((f) => ({ ...f, heartbeat_retention_days: e.target.value }))}
              fullWidth
              inputProps={{ min: 1, max: 3650 }}
            />
            <TextField
              label="Incident retention (days)"
              type="number"
              value={form.incident_retention_days}
              onChange={(e) => setForm((f) => ({ ...f, incident_retention_days: e.target.value }))}
              fullWidth
              inputProps={{ min: 1, max: 3650 }}
            />
            <Typography variant="body2">
              Estimated database size on disk:{' '}
              <Box component="span" sx={{ fontWeight: 600, typography: 'data' }}>
                {settings ? formatBytes(settings.db_size_bytes) : '—'}
              </Box>
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => void saveRetention()} disabled={saving}>
                Save retention
              </Button>
              <Button variant="outlined" color="warning" onClick={() => void purgeNow()} disabled={purging}>
                {purging ? 'Purging…' : 'Purge old data now'}
              </Button>
            </Stack>
          </Stack>
        </GlassCard>
      </Stack>
      ) : null}

      {settingsTab === 2 ? (
      <Stack spacing={2.5} role="tabpanel" id="settings-panel-2" aria-labelledby="settings-tab-2">
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            Self-monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Live view of this process cgroup (typical in Docker). CPU % needs two samples and updates with each poll.
          </Typography>
          <Stack
            sx={{
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              px: 2,
              py: 0.5,
              maxWidth: 560,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1.25 }}>
              <ShowChartIcon className="text-pb-primary" fontSize="small" aria-hidden />
              <Typography
                variant="overline"
                component="h2"
                sx={{ letterSpacing: '0.14em', fontWeight: 700, lineHeight: 1.2 }}
              >
                Resource usage
              </Typography>
            </Stack>
            {metricsError ? (
              <Typography variant="caption" color="error" sx={{ pb: 1 }}>
                {metricsError}
              </Typography>
            ) : null}
            {metrics ? (
              <>
                <MetricRow
                  icon={<SpeedIcon fontSize="inherit" />}
                  label="CPU"
                  value={metrics.cpu_percent != null ? `${metrics.cpu_percent.toFixed(2)}%` : '—'}
                />
                <MetricRow
                  icon={<MemoryIcon fontSize="inherit" />}
                  label="Memory"
                  value={formatMemoryRow(metrics)}
                />
                <MetricRow
                  icon={
                    <Stack direction="row" spacing={0.25} aria-hidden>
                      <SouthIcon sx={{ fontSize: '0.95rem' }} />
                      <NorthIcon sx={{ fontSize: '0.95rem' }} />
                    </Stack>
                  }
                  label="Net I/O"
                  value={formatNetRow(metrics)}
                />
                <MetricRow
                  icon={<StorageIcon fontSize="inherit" />}
                  label="Block I/O"
                  value={formatBlockRow(metrics)}
                />
                <MetricRow
                  icon={<AccountTreeIcon fontSize="inherit" />}
                  label="PIDs"
                  value={formatPidsRow(metrics)}
                />
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Loading metrics…
              </Typography>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                py: 1.25,
                display: 'block',
                borderTop: 1,
                borderColor: 'divider',
                mt: 0.5,
                pt: 1.5,
              }}
            >
              Updates every 3 s while this page is open · live
            </Typography>
            {metrics?.source === 'cgroup_v1_memory' ? (
              <Typography variant="caption" color="text.secondary" sx={{ pb: 1.5, display: 'block' }}>
                cgroup v1: memory limits only. Full stats (CPU %, PIDs, block I/O) need cgroup v2 (common on modern
                Docker).
              </Typography>
            ) : null}
            {metrics?.source === 'process' ? (
              <Typography variant="caption" color="text.secondary" sx={{ pb: 1.5, display: 'block' }}>
                Not running in a cgroup-aware container: showing process RSS and network counters only.
              </Typography>
            ) : null}
          </Stack>
        </GlassCard>
      </Stack>
      ) : null}

      {settingsTab === 3 ? (
      <Stack spacing={2.5} role="tabpanel" id="settings-panel-3" aria-labelledby="settings-tab-3">
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            SSL alerting
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Thresholds apply when TLS validation is enabled on HTTP monitors. Notifications use the same channels as
            uptime alerts.
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Warning threshold (days remaining)"
              type="number"
              value={form.ssl_warning_days}
              onChange={(e) => setForm((f) => ({ ...f, ssl_warning_days: e.target.value }))}
              fullWidth
              inputProps={{ min: 1, max: 3650 }}
            />
            <TextField
              label="Critical threshold (days remaining)"
              type="number"
              value={form.ssl_critical_days}
              onChange={(e) => setForm((f) => ({ ...f, ssl_critical_days: e.target.value }))}
              fullWidth
              inputProps={{ min: 1, max: 3650 }}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">Alert on self-signed certificates</Typography>
              <Button
                size="small"
                variant={form.ssl_alert_self_signed ? 'contained' : 'outlined'}
                onClick={() => setForm((f) => ({ ...f, ssl_alert_self_signed: !f.ssl_alert_self_signed }))}
              >
                {form.ssl_alert_self_signed ? 'On' : 'Off'}
              </Button>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">Alert on TLS below 1.2</Typography>
              <Button
                size="small"
                variant={form.ssl_alert_tls_below_12 ? 'contained' : 'outlined'}
                onClick={() =>
                  setForm((f) => ({ ...f, ssl_alert_tls_below_12: !f.ssl_alert_tls_below_12 }))
                }
              >
                {form.ssl_alert_tls_below_12 ? 'On' : 'Off'}
              </Button>
            </Stack>
            <Button variant="contained" onClick={() => void saveSsl()} disabled={saving}>
              Save SSL settings
            </Button>
          </Stack>
        </GlassCard>
      </Stack>
      ) : null}

      {settingsTab === 4 ? (
      <Stack spacing={2.5} role="tabpanel" id="settings-panel-4" aria-labelledby="settings-tab-4">
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          {about ? (
            <Stack spacing={1}>
              <Typography variant="body2">
                Version: <Box component="span" sx={{ typography: 'data' }}>{about.version}</Box>
              </Typography>
              <Typography variant="body2">
                Server uptime:{' '}
                <Box component="span" sx={{ typography: 'data' }}>
                  {formatUptime(about.uptime_sec)}
                </Box>
              </Typography>
              <Typography variant="body2">
                Node.js: <Box component="span" sx={{ typography: 'data' }}>{about.node_version}</Box>
              </Typography>
              {about.github_url ? (
                <Link href={about.github_url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  GitHub
                  <OpenInNewIcon sx={{ fontSize: '1rem' }} />
                </Link>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Set <Box component="code">PULSEBEAT_GITHUB_URL</Box> in the environment to show a repository link.
                </Typography>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">Loading…</Typography>
          )}
        </GlassCard>
      </Stack>
      ) : null}
    </Box>
  );
}
