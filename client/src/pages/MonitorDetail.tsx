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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import StatusPulse from '../components/StatusPulse';
import ResponseTimeChart from '../components/ResponseTimeChart';
import UptimeBar90 from '../components/UptimeBar90';
import Sparkline from '../components/Sparkline';
import MonitorFormDialog from '../components/MonitorFormDialog';
import type { EnrichedMonitor, HeartbeatPoint, IncidentRow, NotificationItem } from '../types';

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState<EnrichedMonitor | null>(null);
  const [heartbeats, setHeartbeats] = useState<HeartbeatPoint[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id || document.visibilityState !== 'visible') return;
    try {
      const [m, h, inc, n] = await Promise.all([
        apiGet<EnrichedMonitor>(`/api/monitors/${id}`),
        apiGet<HeartbeatPoint[]>(`/api/monitors/${id}/heartbeats?limit=2000`),
        apiGet<IncidentRow[]>(`/api/monitors/${id}/incidents?limit=100`),
        apiGet<NotificationItem[]>('/api/notifications'),
      ]);
      setMonitor(m);
      setHeartbeats(h);
      setIncidents(inc);
      setNotifications(n);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
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

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
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
          <FavoriteIcon
            className="text-pb-primary shrink-0"
            sx={{ fontSize: { xs: '1.75rem', sm: '2rem' } }}
            aria-hidden
          />
          <Typography variant="h4" noWrap>
            {monitor.name}
          </Typography>
        </Box>
        <IconButton aria-label="Edit" onClick={() => setEditOpen(true)}>
          <EditIcon />
        </IconButton>
        <IconButton aria-label="Delete" color="error" onClick={() => setDelOpen(true)}>
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={2.5}>
        <GlassCard sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} lg={3}>
              <Stack spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="h2"
                  sx={{ fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.5 }}
                >
                  Target
                </Typography>
                <Typography
                  variant="data"
                  component="p"
                  sx={{ m: 0, width: '100%', wordBreak: 'break-word', lineHeight: 1.5 }}
                >
                  {monitor.url}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="h3"
                  sx={{ fontWeight: 600, letterSpacing: '0.04em', mt: 1.5, lineHeight: 1.5 }}
                >
                  Type · interval · timeout
                </Typography>
                <Typography variant="body2" component="p" sx={{ m: 0, lineHeight: 1.6 }}>
                  {monitor.type.toUpperCase()} · {monitor.interval}s · {monitor.timeout}ms · retries{' '}
                  {monitor.retries}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <Stack spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0, width: '100%' }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="h2"
                  sx={{ fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.5 }}
                >
                  Latest check
                </Typography>
                <Typography
                  variant="data"
                  component="p"
                  sx={{
                    m: 0,
                    width: '100%',
                    lineHeight: 1.55,
                    pr: { xs: 0, sm: 1 },
                  }}
                >
                  {monitor.latest
                    ? new Date(monitor.latest.checked_at).toLocaleString('en-AU', {
                        timeZone: 'Australia/Sydney',
                      })
                    : '—'}
                </Typography>
                <Chip
                  size="small"
                  sx={{
                    mt: 0.5,
                    typography: 'dataSmall',
                    height: 'auto',
                    minHeight: 28,
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      display: 'block',
                      whiteSpace: 'normal',
                      textAlign: 'left',
                      py: 0.75,
                      px: 1,
                      lineHeight: 1.35,
                    },
                  }}
                  label={
                    monitor.latest
                      ? `${monitor.latest.status === 1 ? 'UP' : 'DOWN'} · ${monitor.latest.message || ''}`
                      : 'No data'
                  }
                />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <Stack spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="h2"
                  sx={{ fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.5 }}
                >
                  90d / 24h uptime
                </Typography>
                <Typography variant="data" component="p" sx={{ m: 0, lineHeight: 1.55 }}>
                  {monitor.uptime_pct_90d != null ? `${monitor.uptime_pct_90d.toFixed(2)}%` : '—'} ·{' '}
                  {monitor.uptime_pct_24h != null ? `${monitor.uptime_pct_24h.toFixed(2)}%` : '—'}
                </Typography>
                <Box sx={{ mt: 0.5, width: '100%', overflow: 'hidden' }}>
                  <UptimeBar90 bars={monitor.daily_bars} />
                </Box>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <Stack spacing={1.25} alignItems={{ xs: 'flex-start', lg: 'flex-end' }} sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="h2"
                  sx={{ fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.5, width: '100%', textAlign: { xs: 'left', lg: 'right' } }}
                >
                  Sparkline (recent)
                </Typography>
                <Box
                  display="flex"
                  justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
                  sx={{ width: '100%' }}
                >
                  <Sparkline values={monitor.sparkline} height={48} />
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </GlassCard>

        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>
            Response time
          </Typography>
          <ResponseTimeChart points={chartPoints} />
        </GlassCard>

        <GlassCard sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>
            Incident history
          </Typography>
          {!incidents.length ? (
            <Typography color="text.secondary">No incidents recorded</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Started</TableCell>
                  <TableCell>Resolved</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Cause</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ typography: 'dataSmall' }}>
                      {new Date(row.started_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
                    </TableCell>
                    <TableCell sx={{ typography: 'dataSmall' }}>
                      {row.resolved_at
                        ? new Date(row.resolved_at).toLocaleString('en-AU', {
                            timeZone: 'Australia/Sydney',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ typography: 'data' }}>
                      {row.duration_sec != null ? `${row.duration_sec}s` : '—'}
                    </TableCell>
                    <TableCell>{row.cause || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCard>
      </Stack>

      <MonitorFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        monitor={monitor}
        notifications={notifications}
        onSaved={load}
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
