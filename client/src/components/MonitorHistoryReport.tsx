import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { apiGet } from '../api';
import ResponseTimeChart from './ResponseTimeChart';
import { formatIncidentDuration, formatIncidentDurationTooltip } from '../utils/incidentDuration';
import type { HeartbeatPoint, IncidentRow } from '../types';

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

export default function MonitorHistoryReport({
  monitorId,
  initialFromYmd,
  initialToYmd,
}: {
  monitorId: number;
  initialFromYmd?: string;
  initialToYmd?: string;
}) {
  const theme = useTheme();
  const muted = theme.palette.text.muted;
  const fontSans = theme.typography.fontFamily;
  const tickLabelStyle = { fontFamily: fontSans, fontSize: 11, fill: muted };
  /** Match `ResponseTimeChart` area fill — softer on OLED than solid series colours. */
  const chartFillOpacity = theme.palette.chart.fillStartOpacity;
  const upFill = alpha(theme.palette.success.main, chartFillOpacity);
  const downFill = alpha(theme.palette.error.main, chartFillOpacity);

  const [toYmd, setToYmd] = useState(() => initialToYmd ?? ymd(new Date()));
  const [fromYmd, setFromYmd] = useState(() => {
    if (initialFromYmd) return initialFromYmd;
    const t = new Date();
    t.setDate(t.getDate() - 7);
    return ymd(t);
  });
  const [heartbeats, setHeartbeats] = useState<HeartbeatPoint[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fromMs = startOfDayMs(fromYmd);
  const toMs = endOfDayMs(toYmd);

  const loadRange = useCallback(async () => {
    if (fromMs > toMs) {
      setError('Start date must be on or before end date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rangeQuery = `from=${fromMs}&to=${toMs}`;
      const [h, inc] = await Promise.all([
        apiGet<HeartbeatPoint[]>(`/api/monitors/${monitorId}/heartbeats?${rangeQuery}&limit=5000`),
        apiGet<IncidentRow[]>(`/api/monitors/${monitorId}/incidents?${rangeQuery}&limit=200`),
      ]);
      setHeartbeats(h);
      setIncidents(inc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [monitorId, fromMs, toMs]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const stats = useMemo(() => {
    const up = heartbeats.filter((p) => p.status === 1).length;
    const down = heartbeats.filter((p) => p.status !== 1).length;
    const total = up + down;
    const pct = total ? (up / total) * 100 : null;
    const latencies = heartbeats.filter((p) => p.status === 1 && p.latency_ms != null).map((p) => p.latency_ms!);
    const avgLat =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    return { up, down, total, pct, avgLat };
  }, [heartbeats]);

  const byDay = useMemo(() => {
    const map = new Map<string, { up: number; down: number }>();
    for (const p of heartbeats) {
      const day = new Date(p.checked_at).toLocaleDateString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const cur = map.get(day) ?? { up: 0, down: 0 };
      if (p.status === 1) cur.up += 1;
      else cur.down += 1;
      map.set(day, cur);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
    return {
      labels: keys,
      up: keys.map((k) => map.get(k)!.up),
      down: keys.map((k) => map.get(k)!.down),
    };
  }, [heartbeats]);

  const linePoints = useMemo(() => [...heartbeats].reverse(), [heartbeats]);
  const outcomes = useMemo(() => {
    const upPct = stats.total ? (stats.up / stats.total) * 100 : 0;
    const downPct = stats.total ? (stats.down / stats.total) * 100 : 0;
    const minDownVisiblePct = stats.down > 0 && downPct < 2 ? 2 : downPct;
    const upVisiblePct = stats.total ? Math.max(0, 100 - minDownVisiblePct) : 0;
    return {
      upPct,
      downPct,
      upVisiblePct,
      downVisiblePct: minDownVisiblePct,
      downIsTiny: stats.down > 0 && downPct < 2,
    };
  }, [stats]);

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFromYmd(ymd(start));
    setToYmd(ymd(end));
  }

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'flex-end',
        }}
      >
        <TextField
          label="From"
          type="date"
          size="small"
          value={fromYmd}
          onChange={(e) => setFromYmd(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={toYmd}
          onChange={(e) => setToYmd(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <Button variant="outlined" size="small" onClick={() => void loadRange()} disabled={loading}>
          Apply range
        </Button>
        <Button variant="text" size="small" onClick={() => setPreset(7)}>
          Last 7 days
        </Button>
        <Button variant="text" size="small" onClick={() => setPreset(30)}>
          Last 30 days
        </Button>
        <Button variant="text" size="small" onClick={() => setPreset(90)}>
          Last 90 days
        </Button>
      </Box>

      {error ? (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Checks in range
            </Typography>
            <Typography variant="h5">{stats.total}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Uptime (checks)
            </Typography>
            <Typography variant="h5">{stats.pct != null ? `${stats.pct.toFixed(1)}%` : '—'}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Avg latency (up checks)
            </Typography>
            <Typography variant="h5">{stats.avgLat != null ? `${stats.avgLat} ms` : '—'}</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Incidents (overlapping range)
            </Typography>
            <Typography variant="h5">{incidents.length}</Typography>
          </Box>
        </Grid>
      </Grid>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Outcomes
        </Typography>
        {stats.total === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No checks in this range
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            <Box
              sx={{
                position: 'relative',
                height: 30,
                borderRadius: 1.25,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${outcomes.upVisiblePct}%`,
                  bgcolor: upFill,
                }}
              />
              {stats.down > 0 ? (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${outcomes.downVisiblePct}%`,
                    minWidth: outcomes.downIsTiny ? 14 : undefined,
                    bgcolor: downFill,
                  }}
                />
              ) : null}

              <Typography
                variant="body2"
                sx={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'success.contrastText',
                  fontWeight: 600,
                }}
              >
                {`Up ${stats.up} — ${outcomes.upPct.toFixed(1)}%`}
              </Typography>

              {stats.down > 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    position: 'absolute',
                    right: outcomes.downIsTiny ? 18 : 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: outcomes.downIsTiny ? 'error.main' : 'error.contrastText',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    textShadow: outcomes.downIsTiny ? 'none' : '0 1px 1px rgba(0,0,0,0.35)',
                  }}
                >
                  {`Down ${stats.down} — ${outcomes.downPct.toFixed(1)}%`}
                </Typography>
              ) : null}
            </Box>
            <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    bgcolor: upFill,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Up checks
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    bgcolor: downFill,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Down checks
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Checks per day (Sydney)
        </Typography>
        {byDay.labels.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4 }}>
            No daily breakdown
          </Typography>
        ) : (
          <Stack spacing={1.25} alignItems="center" sx={{ width: '100%' }}>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <BarChart
                height={260}
                margin={{ left: 48, right: 16, top: 8, bottom: 56 }}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: byDay.labels,
                    tickLabelStyle: { ...tickLabelStyle, angle: -35, textAnchor: 'end' },
                  },
                ]}
                yAxis={[{ tickLabelStyle, stroke: muted }]}
                series={[
                  {
                    type: 'bar',
                    data: byDay.up,
                    label: 'Up',
                    color: upFill,
                    stack: 'd',
                  },
                  {
                    type: 'bar',
                    data: byDay.down,
                    label: 'Down',
                    color: downFill,
                    stack: 'd',
                  },
                ]}
                slotProps={{
                  legend: { hidden: true },
                }}
                sx={{
                  '& .MuiBarElement-root': {
                    stroke: theme.palette.divider,
                    strokeWidth: 1,
                  },
                }}
              />
            </Box>
            <Stack direction="row" spacing={2.5} flexWrap="wrap" justifyContent="center" useFlexGap>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 0.5,
                    bgcolor: upFill,
                    border: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Up ({stats.up})
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 0.5,
                    bgcolor: downFill,
                    border: 1,
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Down ({stats.down})
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Response time
        </Typography>
        <ResponseTimeChart points={linePoints} height={240} />
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Incident log (overlapping range)
        </Typography>
        {!incidents.length ? (
          <Typography color="text.secondary">No incidents in this range</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 320, width: '100%', overflowX: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Started</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Resolved</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Duration</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Cause</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ typography: 'dataSmall', whiteSpace: 'nowrap' }}>
                      {new Date(row.started_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
                    </TableCell>
                    <TableCell sx={{ typography: 'dataSmall', whiteSpace: 'nowrap' }}>
                      {row.resolved_at
                        ? new Date(row.resolved_at).toLocaleString('en-AU', {
                            timeZone: 'Australia/Sydney',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ typography: 'data', whiteSpace: 'nowrap' }}>
                      <Tooltip title={formatIncidentDurationTooltip(row.duration_sec)} arrow>
                        <Box component="span">{formatIncidentDuration(row.duration_sec)}</Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>{row.cause || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
}
