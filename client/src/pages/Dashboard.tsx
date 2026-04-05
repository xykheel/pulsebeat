import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BuildIcon from '@mui/icons-material/Build';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Link as RouterLink } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { apiGet, apiSend } from '../api';
import DashboardStatCards from '../components/DashboardStatCards';
import MonitorFormDialog from '../components/MonitorFormDialog';
import MonitorLatencyBars from '../components/MonitorLatencyBars';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../contexts/AuthContext';
import type { EnrichedMonitor, MaintenanceWindowRow, NotificationItem, SummaryStats, TagRow } from '../types';

type StatusFilter = 'up' | 'down' | 'paused';

const ROWS_OPTIONS = [15, 30, 50] as const;

function monitorMatchesStatus(m: EnrichedMonitor, f: StatusFilter): boolean {
  if (f === 'paused') return !m.active;
  if (!m.active) return false;
  if (f === 'up') return m.latest?.status === 1;
  return m.latest?.status !== 1 || !m.latest;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [monitors, setMonitors] = useState<EnrichedMonitor[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [activeMaint, setActiveMaint] = useState<MaintenanceWindowRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMonitor, setEditMonitor] = useState<EnrichedMonitor | null>(null);

  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter[]>([]);
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [pauseBusyId, setPauseBusyId] = useState<number | null>(null);
  const [refreshBusyId, setRefreshBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [m, n, s, t, mw] = await Promise.all([
        apiGet<EnrichedMonitor[]>('/api/monitors'),
        apiGet<NotificationItem[]>('/api/notifications'),
        apiGet<SummaryStats>('/api/summary'),
        apiGet<TagRow[]>('/api/tags'),
        apiGet<{ windows: MaintenanceWindowRow[] }>('/api/maintenance-windows/active'),
      ]);
      setMonitors(m);
      setNotifications(n);
      setSummary(s);
      setTags(t);
      setActiveMaint(mw.windows ?? []);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monitors.filter((m) => {
      if (typeFilter.length && !typeFilter.includes(m.type)) return false;
      if (statusFilter.length && !statusFilter.some((sf) => monitorMatchesStatus(m, sf))) return false;
      if (tagFilter.length) {
        const ids = new Set(m.tags.map((t) => t.id));
        const any = tagFilter.some((tid) => ids.has(tid));
        if (!any) return false;
      }
      if (q) {
        const name = m.name.toLowerCase();
        const url = m.url.toLowerCase();
        if (!name.includes(q) && !url.includes(q)) return false;
      }
      return true;
    });
  }, [monitors, typeFilter, statusFilter, tagFilter, search]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, statusFilter, tagFilter, search, rowsPerPage]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  function openAdd() {
    setEditMonitor(null);
    setDialogOpen(true);
  }

  function openEdit(m: EnrichedMonitor) {
    setEditMonitor(m);
    setDialogOpen(true);
  }

  async function toggleMonitorActive(m: EnrichedMonitor) {
    if (pauseBusyId != null) return;
    setPauseBusyId(m.id);
    try {
      await apiSend(`/api/monitors/${m.id}`, 'PUT', { active: m.active ? 0 : 1 });
      await load();
    } catch {
      /* keep UI; next poll may refresh */
    } finally {
      setPauseBusyId(null);
    }
  }

  async function refreshMonitorRow(m: EnrichedMonitor) {
    if (refreshBusyId != null) return;
    setRefreshBusyId(m.id);
    try {
      const updated = await apiSend<EnrichedMonitor>(`/api/monitors/${m.id}/check`, 'POST');
      if (updated) {
        setMonitors((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      }
    } catch {
      await load();
    } finally {
      setRefreshBusyId(null);
    }
  }

  const displayName = user?.username?.trim() || 'there';

  const onTypes = (e: SelectChangeEvent<string[]>) => {
    const v = e.target.value;
    setTypeFilter(typeof v === 'string' ? v.split(',') : v);
  };
  const onStatuses = (e: SelectChangeEvent<StatusFilter[]>) => {
    const v = e.target.value;
    setStatusFilter(typeof v === 'string' ? (v.split(',') as StatusFilter[]) : v);
  };
  const onTags = (e: SelectChangeEvent<number[]>) => {
    const v = e.target.value;
    setTagFilter(typeof v === 'string' ? v.split(',').map(Number) : v);
  };

  return (
    <Box>
      {activeMaint.length ? (
        <Alert severity="warning" icon={<BuildIcon />} sx={{ mb: 2 }} className="border-amber-500/40">
          Maintenance in progress
          {activeMaint.some((w) => w.monitor_id == null)
            ? ' (all monitors)'
            : `: ${activeMaint.map((w) => w.name).join(', ')}`}
        </Alert>
      ) : null}

      <Box className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Box>
          <Typography variant="h4" component="h1" className="tracking-tight">
            Hey there, {displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Track uptime, response times, and SSL health from one place.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          className="w-full shrink-0 whitespace-nowrap lg:w-auto"
        >
          Add monitor
        </Button>
      </Box>

      <DashboardStatCards summary={summary} />

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
            {filtered.length} monitor{filtered.length === 1 ? '' : 's'}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="df-type">Type</InputLabel>
            <Select
              labelId="df-type"
              multiple
              value={typeFilter}
              onChange={onTypes}
              input={<OutlinedInput label="Type" />}
              renderValue={(sel) => (sel as string[]).join(', ') || 'All'}
            >
              <MenuItem value="http">HTTP</MenuItem>
              <MenuItem value="tcp">TCP</MenuItem>
              <MenuItem value="ping">Ping</MenuItem>
              <MenuItem value="dns">DNS</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="df-st">Status</InputLabel>
            <Select
              labelId="df-st"
              multiple
              value={statusFilter}
              onChange={onStatuses}
              input={<OutlinedInput label="Status" />}
              renderValue={(sel) => (sel as string[]).join(', ') || 'All'}
            >
              <MenuItem value="up">Up</MenuItem>
              <MenuItem value="down">Down</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="df-tag">Tags</InputLabel>
            <Select
              labelId="df-tag"
              multiple
              value={tagFilter}
              onChange={onTags}
              input={<OutlinedInput label="Tags" />}
              renderValue={(sel) =>
                (sel as number[])
                  .map((id) => tags.find((t) => t.id === id)?.name || String(id))
                  .join(', ') || 'All'
              }
            >
              {tags.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Search"
            placeholder="Name or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 200 } }}
          />
        </Box>

        {!monitors.length ? (
          <Box sx={{ px: 2, py: 4 }}>
            <Typography color="text.secondary">No monitors yet. Add one to begin tracking uptime.</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Host</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Response time</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map((m) => {
                    const inactive = !m.active;
                    const up = m.latest?.status === 1;
                    const statusLabel = inactive ? 'Paused' : up ? 'Up' : 'Down';
                    const displayUrl = m.type === 'dns' ? String(m.dns_config?.hostname || m.url) : m.url;
                    return (
                      <TableRow
                        key={m.id}
                        hover
                        sx={{
                          '& td': { borderBottom: 1, borderColor: 'divider' },
                          transition: 'box-shadow 0.15s ease',
                          '&:hover': {
                            boxShadow: 'inset 4px 0 12px -4px rgba(34, 211, 238, 0.55)',
                          },
                        }}
                      >
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Box component={RouterLink} to={`/monitors/${m.id}`} className="block no-underline text-inherit">
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {m.in_maintenance ? <span title="Maintenance">🔧 </span> : null}
                              {m.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              {displayUrl}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={statusLabel}
                            color={inactive ? 'warning' : up ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ height: 24, typography: 'caption', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <MonitorLatencyBars checks={m.recent_checks_30} />
                        </TableCell>
                        <TableCell sx={{ typography: 'caption', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {m.type}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 160, verticalAlign: 'middle' }}>
                          {m.tags[0] ? (
                            <Chip
                              label={m.tags[0].name}
                              size="small"
                              title={
                                m.tags.length > 1
                                  ? m.tags.map((t) => t.name).join(', ')
                                  : undefined
                              }
                              sx={{
                                height: 22,
                                maxWidth: '100%',
                                fontSize: '0.7rem',
                                bgcolor: `${m.tags[0].color}33`,
                                border: '1px solid',
                                borderColor: `${m.tags[0].color}55`,
                                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={m.active ? 'Pause monitor' : 'Resume monitor'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={m.active ? 'Pause monitor' : 'Resume monitor'}
                                disabled={pauseBusyId === m.id}
                                onClick={() => void toggleMonitorActive(m)}
                              >
                                {m.active ? (
                                  <PauseIcon fontSize="small" />
                                ) : (
                                  <PlayArrowIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Check now">
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Check monitor now"
                                disabled={refreshBusyId === m.id}
                                onClick={() => void refreshMonitorRow(m)}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <IconButton size="small" aria-label="Edit monitor" onClick={() => openEdit(m)}>
                            <SettingsOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={ROWS_OPTIONS as unknown as number[]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
            />
          </>
        )}
      </GlassCard>

      <MonitorFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        monitor={editMonitor}
        notifications={notifications}
        tags={tags}
        onSaved={load}
        onTagsChanged={load}
      />
    </Box>
  );
}
