import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
  IconButton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BuildIcon from '@mui/icons-material/Build';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import StatusPulse from '../components/StatusPulse';
import ResponseTimeChart from '../components/ResponseTimeChart';
import UptimeBar90 from '../components/UptimeBar90';
import MonitorFormDialog from '../components/MonitorFormDialog';
import SslHealthPanel from '../components/SslHealthPanel';
import MonitorHistoryReport from '../components/MonitorHistoryReport';
import type {
  DnsConfig,
  EnrichedMonitor,
  HeartbeatPoint,
  IncidentRow,
  MaintenanceWindowRow,
  NotificationItem,
  SslCheckRow,
  TagRow,
} from '../types';

type ChecksStatusFilter = 'all' | 'up' | 'down';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDayMs(ymdStr: string): number {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfDayMs(ymdStr: string): number {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState<EnrichedMonitor | null>(null);
  const [heartbeats, setHeartbeats] = useState<HeartbeatPoint[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [sslChecks, setSslChecks] = useState<SslCheckRow[]>([]);
  const [activeMaint, setActiveMaint] = useState<MaintenanceWindowRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [error, setError] = useState('');
  const [detailTab, setDetailTab] = useState(0);
  const [checksStatus, setChecksStatus] = useState<ChecksStatusFilter>('all');
  const [checksFromYmd, setChecksFromYmd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return ymd(d);
  });
  const [checksToYmd, setChecksToYmd] = useState(() => ymd(new Date()));
  const [checksRows, setChecksRows] = useState<HeartbeatPoint[]>([]);
  const [checksIncidents, setChecksIncidents] = useState<IncidentRow[]>([]);
  const [checksLoading, setChecksLoading] = useState(false);
  const [checksError, setChecksError] = useState('');
  const [checksPage, setChecksPage] = useState(0);
  const [historyPreset, setHistoryPreset] = useState<{ fromYmd: string; toYmd: string } | null>(null);
  const [historyPresetKey, setHistoryPresetKey] = useState(0);

  const load = useCallback(async () => {
    if (!id || document.visibilityState !== 'visible') return;
    try {
      const mid = Number(id);
      const [m, h, inc, n, t, mw] = await Promise.all([
        apiGet<EnrichedMonitor>(`/api/monitors/${id}`),
        apiGet<HeartbeatPoint[]>(`/api/monitors/${id}/heartbeats?limit=2000`),
        apiGet<IncidentRow[]>(`/api/monitors/${id}/incidents?limit=100`),
        apiGet<NotificationItem[]>('/api/notifications'),
        apiGet<TagRow[]>('/api/tags'),
        apiGet<{ windows: MaintenanceWindowRow[] }>('/api/maintenance-windows/active'),
      ]);
      setMonitor(m);
      setHeartbeats(h);
      setIncidents(inc);
      setNotifications(n);
      setTags(t);
      const relevant = (mw.windows ?? []).filter(
        (w) => w.monitor_id == null || w.monitor_id === mid
      );
      setActiveMaint(relevant);
      let ssl: SslCheckRow[] = [];
      if (m.check_ssl === 1) {
        try {
          ssl = await apiGet<SslCheckRow[]>(`/api/monitors/${id}/ssl-checks?limit=30`);
        } catch {
          ssl = [];
        }
      }
      setSslChecks(ssl);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDetailTab(0);
  }, [id]);

  useEffect(() => {
    setChecksPage(0);
  }, [checksStatus, checksFromYmd, checksToYmd]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function confirmDelete() {
    try {
      await apiSend(`/api/monitors/${id}`, 'DELETE');
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
    setDelOpen(false);
  }

  async function loadChecksRange() {
    const fromMs = startOfDayMs(checksFromYmd);
    const toMs = endOfDayMs(checksToYmd);
    if (fromMs > toMs) {
      setChecksError('Start date must be on or before end date.');
      return;
    }
    setChecksLoading(true);
    setChecksError('');
    try {
      const [rows, rangeIncidents] = await Promise.all([
        apiGet<HeartbeatPoint[]>(`/api/monitors/${id}/heartbeats?from=${fromMs}&to=${toMs}&limit=5000`),
        apiGet<IncidentRow[]>(`/api/monitors/${id}/incidents?from=${fromMs}&to=${toMs}&limit=500`),
      ]);
      setChecksRows(rows);
      setChecksIncidents(rangeIncidents);
    } catch (e) {
      setChecksError(e instanceof Error ? e.message : 'Failed to load checks');
    } finally {
      setChecksLoading(false);
    }
  }

  useEffect(() => {
    if (detailTab === 2) {
      void loadChecksRange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, id]);

  if (error && !monitor) {
    return (
      <Box>
        <Alert severity="error">{error}</Alert>
        <Button component={RouterLink} to="/" sx={{ mt: 2 }}>
          Back
        </Button>
      </Box>
    );
  }

  if (!monitor) return null;

  const up = monitor.latest?.status === 1;
  const inactive = !monitor.active;
  const chartPoints = [...heartbeats].reverse().filter((p) => p.latency_ms != null);
  const recentChecks = heartbeats.slice(0, 10);
  const isHttps = monitor.type === 'http' && monitor.url.trim().toLowerCase().startsWith('https:');
  const dnsCfg = monitor.dns_config as DnsConfig;
  const maintBanner = activeMaint.length > 0;
  const latestSsl = sslChecks[0] ?? null;
  const sslDaysRemaining = latestSsl?.days_remaining ?? null;

  function setChecksPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setChecksFromYmd(ymd(start));
    setChecksToYmd(ymd(end));
  }

  function exportChecksCsv(rows: HeartbeatPoint[]) {
    const header = ['Time (Sydney)', 'Status', 'Latency (ms)', 'Message'];
    const safeCsvCell = (value: string): string => {
      const trimmed = value.trimStart();
      const dangerous = trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@');
      return dangerous ? `'${value}` : value;
    };
    const csvRows = rows.map((row) => [
      safeCsvCell(new Date(row.checked_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })),
      safeCsvCell(row.status === 1 ? 'UP' : 'DOWN'),
      safeCsvCell(row.latency_ms != null ? String(row.latency_ms) : ''),
      safeCsvCell((row.message || '').replace(/\r?\n/g, ' ').trim()),
    ]);

    const csv = [header, ...csvRows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitor-${id ?? 'unknown'}-checks-${checksFromYmd}-to-${checksToYmd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function findIncidentForCheck(checkedAt: number): IncidentRow | null {
    const match = checksIncidents.find((incident) => {
      const endsAt = incident.resolved_at ?? Number.POSITIVE_INFINITY;
      return incident.started_at <= checkedAt && checkedAt <= endsAt;
    });
    return match ?? null;
  }

  const filteredChecks = checksRows.filter((row) => {
    if (checksStatus === 'all') return true;
    if (checksStatus === 'up') return row.status === 1;
    return row.status !== 1;
  });
  const checksPageSize = 25;
  const checksTotalPages = Math.max(1, Math.ceil(filteredChecks.length / checksPageSize));
  const currentPage = Math.min(checksPage, checksTotalPages - 1);
  const pagedChecks = filteredChecks.slice(currentPage * checksPageSize, (currentPage + 1) * checksPageSize);

  function openIncidentInHistory(check: HeartbeatPoint) {
    const incident = findIncidentForCheck(check.checked_at);
    if (!incident) return;
    const fromYmd = ymd(new Date(incident.started_at));
    const toYmd = ymd(new Date(incident.resolved_at ?? Date.now()));
    setHistoryPreset({ fromYmd, toYmd });
    setHistoryPresetKey((prev) => prev + 1);
    setDetailTab(1);
  }

  const renderChecksTable = (rows: HeartbeatPoint[]) => {
    if (!rows.length) {
      return <Typography color="text.secondary">No checks yet</Typography>;
    }
    return (
      <TableContainer sx={{ maxHeight: 380 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Time (Sydney)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Latency</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                sx={
                  row.status === 1
                    ? undefined
                    : {
                        backgroundColor: (t) => `${t.palette.error.main}24`,
                        '& > *': {
                          backgroundColor: 'transparent',
                        },
                      }
                }
              >
                <TableCell sx={{ typography: 'dataSmall', whiteSpace: 'nowrap' }}>
                  {new Date(row.checked_at).toLocaleString('en-AU', {
                    timeZone: 'Australia/Sydney',
                  })}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.status === 1 ? 'UP' : 'DOWN'}
                    color={row.status === 1 ? 'success' : 'error'}
                    sx={{ height: 22, typography: 'caption' }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ typography: 'dataSmall' }}>
                  {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                </TableCell>
                <TableCell sx={{ typography: 'body2', maxWidth: 320 }}>{row.message || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box>
      <GlassCard sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton component={RouterLink} to="/" aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Box display="flex" alignItems="center" gap={1.5} flexGrow={1} minWidth={0}>
          {inactive ? (
            <Box
              sx={(t) => ({
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: t.palette.status.inactive,
              })}
            />
          ) : (
            <StatusPulse up={up} />
          )}
          <Typography variant="h4" noWrap component="span">
            {monitor.in_maintenance ? <span title="Maintenance">🔧 </span> : null}
            {monitor.name}
          </Typography>
          {monitor.type === 'http' && monitor.check_ssl ? (
            <Chip size="small" label="TLS" sx={{ typography: 'caption', height: 24 }} />
          ) : null}
        </Box>
        <IconButton aria-label="Edit" onClick={() => setEditOpen(true)}>
          <EditIcon />
        </IconButton>
        <IconButton aria-label="Delete" color="error" onClick={() => setDelOpen(true)}>
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
          <Chip
            size="small"
            label={`90d / 24h ${monitor.uptime_pct_90d != null ? `${monitor.uptime_pct_90d.toFixed(2)}%` : '—'} / ${monitor.uptime_pct_24h != null ? `${monitor.uptime_pct_24h.toFixed(2)}%` : '—'}`}
          />
          <Chip size="small" label={`avg ${monitor.avg_latency_ms != null ? `${monitor.avg_latency_ms} ms` : '—'}`} />
          {monitor.type === 'http' && monitor.check_ssl ? (
            <Chip
              size="small"
              label={`SSL ${sslDaysRemaining != null ? `${sslDaysRemaining}d` : '—'}`}
              color={sslDaysRemaining != null && sslDaysRemaining <= 7 ? 'error' : 'default'}
            />
          ) : null}
          {monitor.tags.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                bgcolor: `${t.color}33`,
                border: '1px solid',
                borderColor: `${t.color}55`,
              }}
            />
          ))}
        </Stack>
      </GlassCard>

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {maintBanner ? (
        <Alert severity="warning" icon={<BuildIcon />} sx={{ mb: 2 }}>
          This monitor is in an active maintenance window. Checks still run, but alerts and new incidents are
          suppressed.
        </Alert>
      ) : null}

      <Tabs
        value={detailTab}
        onChange={(_, v) => setDetailTab(v)}
        sx={{ mb: 2 }}
        aria-label="Monitor detail views"
      >
        <Tab label="Live" id="monitor-tab-live" aria-controls="monitor-panel-live" />
        <Tab label="History" id="monitor-tab-history" aria-controls="monitor-panel-history" />
        <Tab label="Checks" id="monitor-tab-checks" aria-controls="monitor-panel-checks" />
      </Tabs>

      {detailTab === 1 ? (
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            Historical report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a date range to review retained checks, uptime mix, response times, and incidents.
          </Typography>
          <MonitorHistoryReport
            key={`${monitor.id}-${historyPresetKey}`}
            monitorId={monitor.id}
            initialFromYmd={historyPreset?.fromYmd}
            initialToYmd={historyPreset?.toYmd}
          />
        </GlassCard>
      ) : null}

      {detailTab === 0 ? (
      <Stack spacing={2.5}>
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h6" gutterBottom>
            90 day availability
          </Typography>
          <UptimeBar90 bars={monitor.daily_bars} />
        </GlassCard>

        {monitor.type === 'dns' ? (
          <GlassCard sx={{ p: 2.5 }}>
            <Typography variant="h6" gutterBottom>
              DNS
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Current resolved value
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                  {monitor.latest?.resolved_value || '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Expected value
                </Typography>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {dnsCfg.expected_ip ? String(dnsCfg.expected_ip) : '— (not set)'}
                  </Typography>
                  {dnsCfg.expected_ip ? (
                    <Chip
                      size="small"
                      label={
                        monitor.latest?.resolved_value &&
                        String(monitor.latest.resolved_value)
                          .toLowerCase()
                          .includes(String(dnsCfg.expected_ip).toLowerCase())
                          ? 'Match'
                          : 'Mismatch'
                      }
                      color={
                        monitor.latest?.resolved_value &&
                        String(monitor.latest.resolved_value)
                          .toLowerCase()
                          .includes(String(dnsCfg.expected_ip).toLowerCase())
                          ? 'success'
                          : 'warning'
                      }
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Record type
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {String(dnsCfg.record_type || 'A')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Resolver
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {dnsCfg.resolver && String(dnsCfg.resolver).trim()
                    ? String(dnsCfg.resolver)
                    : 'System default'}
                </Typography>
              </Grid>
            </Grid>
          </GlassCard>
        ) : null}

        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>
            Response time
          </Typography>
          <ResponseTimeChart points={chartPoints} incidents={incidents} timezone="Australia/Sydney" />
        </GlassCard>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ display: 'flex' }}>
            {monitor.check_ssl === 1 ? (
              <SslHealthPanel latest={latestSsl} history={sslChecks} sx={{ width: '100%' }} />
            ) : isHttps ? (
              <GlassCard sx={{ p: 2.5, width: '100%', height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  SSL / TLS health
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  TLS validation is off. Enable "Validate TLS certificate" in Edit to record certificate health.
                </Typography>
              </GlassCard>
            ) : (
              <GlassCard sx={{ p: 2.5, width: '100%', height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  SSL / TLS health
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This monitor does not use HTTPS, so no TLS certificate data is available.
                </Typography>
              </GlassCard>
            )}
          </Box>
          <Box sx={{ display: 'flex' }}>
            <GlassCard sx={{ p: 2.5, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Monitor config
              </Typography>
              <Stack spacing={1.25} sx={{ flexGrow: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  <strong>Target:</strong> {monitor.type === 'dns' ? String(dnsCfg.hostname || monitor.url) : monitor.url}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {monitor.type.toUpperCase()}
                </Typography>
                <Typography variant="body2">
                  <strong>Interval / timeout:</strong> {monitor.interval}s / {monitor.timeout}ms
                </Typography>
                <Typography variant="body2">
                  <strong>Retries:</strong> {monitor.retries}
                </Typography>
                <Typography variant="body2">
                  <strong>TLS validation:</strong>{' '}
                  {monitor.type === 'http' ? (monitor.check_ssl ? 'Enabled' : 'Disabled') : 'Not applicable'}
                </Typography>
                <Chip
                  size="small"
                  sx={{ alignSelf: 'flex-start', mt: 'auto' }}
                  color={monitor.latest?.status === 1 ? 'success' : 'error'}
                  label={
                    monitor.latest
                      ? `Latest: ${monitor.latest.status === 1 ? 'UP' : 'DOWN'} · ${monitor.latest.message || 'No message'} · ${new Date(monitor.latest.checked_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
                      : 'Latest: no checks yet'
                  }
                />
              </Stack>
            </GlassCard>
          </Box>
        </Box>

        <GlassCard sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Recent checks</Typography>
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={() => setDetailTab(2)}
              sx={{ typography: 'body2' }}
            >
              View all in Checks tab →
            </Link>
          </Stack>
          {renderChecksTable(recentChecks)}
        </GlassCard>
      </Stack>
      ) : null}

      {detailTab === 2 ? (
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', lg: 'center' }}
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" sx={{ mr: 1 }}>
                Checks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Show
              </Typography>
              <Button
                size="small"
                variant={checksStatus === 'all' ? 'contained' : 'outlined'}
                onClick={() => setChecksStatus('all')}
              >
                All
              </Button>
              <Button
                size="small"
                variant={checksStatus === 'up' ? 'contained' : 'outlined'}
                onClick={() => setChecksStatus('up')}
                color="success"
              >
                UP
              </Button>
              <Button
                size="small"
                variant={checksStatus === 'down' ? 'contained' : 'outlined'}
                onClick={() => setChecksStatus('down')}
                color="error"
              >
                DOWN
              </Button>
            </Stack>
            <Button
              variant="outlined"
              size="small"
              onClick={() => exportChecksCsv(filteredChecks)}
              disabled={filteredChecks.length === 0}
            >
              Export CSV
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={checksFromYmd}
              onChange={(e) => setChecksFromYmd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={checksToYmd}
              onChange={(e) => setChecksToYmd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <Button variant="outlined" size="small" onClick={() => void loadChecksRange()} disabled={checksLoading}>
              Apply range
            </Button>
            <Button variant="text" size="small" onClick={() => setChecksPreset(7)}>
              Last 7d
            </Button>
            <Button variant="text" size="small" onClick={() => setChecksPreset(30)}>
              Last 30d
            </Button>
            <Button variant="text" size="small" onClick={() => setChecksPreset(90)}>
              Last 90d
            </Button>
          </Stack>

          {checksError ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {checksError}
            </Alert>
          ) : null}

          {!pagedChecks.length ? (
            <Typography color="text.secondary">No checks match this filter.</Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Time (Sydney)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Latency</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedChecks.map((row) => {
                    const linkedIncident = row.status === 1 ? null : findIncidentForCheck(row.checked_at);
                    return (
                      <TableRow
                        key={row.id}
                        sx={
                          row.status === 1
                            ? undefined
                            : {
                                backgroundColor: (t) => `${t.palette.error.main}24`,
                                '& > *': {
                                  backgroundColor: 'transparent',
                                },
                              }
                        }
                      >
                        <TableCell sx={{ typography: 'dataSmall', whiteSpace: 'nowrap' }}>
                          {new Date(row.checked_at).toLocaleString('en-AU', {
                            timeZone: 'Australia/Sydney',
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.status === 1 ? 'UP' : 'DOWN'}
                            color={row.status === 1 ? 'success' : 'error'}
                            sx={{ height: 22, typography: 'caption' }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ typography: 'dataSmall' }}>
                          {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                        </TableCell>
                        <TableCell sx={{ typography: 'body2', maxWidth: 420 }}>
                          {row.message || '—'}
                          {linkedIncident ? (
                            <Link
                              component="button"
                              type="button"
                              underline="hover"
                              sx={{ ml: 1, typography: 'body2' }}
                              onClick={() => openIncidentInHistory(row)}
                            >
                              incident →
                            </Link>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.5 }}
          >
            <Typography variant="body2" color="text.secondary">
              Showing {filteredChecks.length === 0 ? 0 : currentPage * checksPageSize + 1}-
              {Math.min((currentPage + 1) * checksPageSize, filteredChecks.length)} of {filteredChecks.length} checks
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setChecksPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                ← Prev
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setChecksPage((prev) => Math.min(checksTotalPages - 1, prev + 1))}
                disabled={currentPage >= checksTotalPages - 1}
              >
                Next →
              </Button>
            </Stack>
          </Stack>
        </GlassCard>
      ) : null}

      <MonitorFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        monitor={monitor}
        notifications={notifications}
        tags={tags}
        onSaved={load}
        onTagsChanged={load}
      />

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}>
        <DialogTitle>Delete monitor?</DialogTitle>
        <DialogContent>
          <Typography>
            This removes <strong>{monitor.name}</strong> and all heartbeats and incidents. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
