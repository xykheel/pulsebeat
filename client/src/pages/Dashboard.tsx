import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  OutlinedInput,
  Select,
  Snackbar,
  Stack,
  Switch,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DnsIcon from '@mui/icons-material/Dns';
import HttpIcon from '@mui/icons-material/Http';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LanIcon from '@mui/icons-material/Lan';
import NetworkPingIcon from '@mui/icons-material/NetworkPing';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../contexts/AuthContext';
import type { EnrichedMonitor, MaintenanceWindowRow, SummaryStats, TagRow } from '../types';

type StatusFilter = 'up' | 'down' | 'paused';
type TypeFilter = 'all' | 'http' | 'tcp' | 'ping' | 'dns';
type SortKey = 'uptime' | 'lastCheck';
type SortDirection = 'asc' | 'desc';

const ROWS_OPTIONS = [15, 30, 50] as const;
const REFRESH_INTERVAL_SECONDS = 30;

interface AddFormState {
  type: EnrichedMonitor['type'];
  name: string;
  url: string;
  interval: string;
  timeout: string;
  retries: string;
  checkSsl: boolean;
  tagIds: number[];
  advancedOpen: boolean;
  headers: string;
  auth: string;
  requestBody: string;
}

function initialAddForm(): AddFormState {
  return {
    type: 'http',
    name: '',
    url: '',
    interval: '60',
    timeout: '10000',
    retries: '0',
    checkSsl: true,
    tagIds: [],
    advancedOpen: false,
    headers: '',
    auth: '',
    requestBody: '',
  };
}

function relativeTime(ms: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

function uptime30d(m: EnrichedMonitor): number | null {
  const bars = m.daily_bars.slice(-30).filter((b) => b.pct != null);
  if (!bars.length) return null;
  return bars.reduce((acc, b) => acc + (b.pct ?? 0), 0) / bars.length;
}

function statusFromMonitor(m: EnrichedMonitor): StatusFilter {
  if (!m.active) return 'paused';
  return m.latest?.status === 1 ? 'up' : 'down';
}

function statusMatches(m: EnrichedMonitor, f: StatusFilter | null): boolean {
  if (!f) return true;
  return statusFromMonitor(m) === f;
}

function parseHttpCode(msg: string | null): string {
  if (!msg) return '—';
  const match = msg.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? match[1] : '—';
}

function staleMinutes(m: EnrichedMonitor): number | null {
  if (!m.latest?.checked_at) return null;
  const age = Date.now() - m.latest.checked_at;
  const threshold = m.interval * 1000 * 1.5;
  if (age <= threshold) return null;
  return Math.max(1, Math.floor(age / 60000));
}

function metricColour(uptime: number | null): string {
  if (uptime == null) return '#C7CCD1';
  if (uptime >= 99.5) return '#4ECB9A';
  if (uptime >= 97) return '#F2B35B';
  return '#F09595';
}

function cycleSort(key: SortKey, currentKey: SortKey | null, currentDir: SortDirection): { key: SortKey | null; dir: SortDirection } {
  if (currentKey !== key) return { key, dir: 'desc' };
  if (currentDir === 'desc') return { key, dir: 'asc' };
  return { key: null, dir: 'desc' };
}

function monitorTypeIcon(type: EnrichedMonitor['type']) {
  if (type === 'http') return <HttpIcon fontSize="small" />;
  if (type === 'tcp') return <LanIcon fontSize="small" />;
  if (type === 'ping') return <NetworkPingIcon fontSize="small" />;
  return <DnsIcon fontSize="small" />;
}

function typeLabel(t: EnrichedMonitor['type']): string {
  if (t === 'http') return 'HTTP / HTTPS';
  if (t === 'tcp') return 'TCP';
  if (t === 'ping') return 'Ping';
  return 'DNS';
}

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [monitors, setMonitors] = useState<EnrichedMonitor[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [activeMaint, setActiveMaint] = useState<MaintenanceWindowRow[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(initialAddForm);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const [quickEditMonitor, setQuickEditMonitor] = useState<EnrichedMonitor | null>(null);
  const [quickEditName, setQuickEditName] = useState('');
  const [quickEditInterval, setQuickEditInterval] = useState('60');
  const [quickEditTimeout, setQuickEditTimeout] = useState('10000');
  const [quickEditTagIds, setQuickEditTagIds] = useState<number[]>([]);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagDialogTarget, setTagDialogTarget] = useState<'add' | 'quick'>('add');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColour, setNewTagColour] = useState('#4ECB9A');
  const [newTagSaving, setNewTagSaving] = useState(false);
  const [newTagError, setNewTagError] = useState('');

  const [pauseBusyId, setPauseBusyId] = useState<number | null>(null);
  const [refreshBusyId, setRefreshBusyId] = useState<number | null>(null);
  const [pauseConfirmMonitor, setPauseConfirmMonitor] = useState<EnrichedMonitor | null>(null);
  const [skipPauseConfirm, setSkipPauseConfirm] = useState(false);
  const [resumeToast, setResumeToast] = useState('');
  const [highlightRowId, setHighlightRowId] = useState<number | null>(null);
  const [forceStatus, setForceStatus] = useState<Record<number, { kind: 'checking' | 'success' | 'down'; message: string }>>({});

  const [rawSearch, setRawSearch] = useState(searchParams.get('q') ?? '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(
    (searchParams.get('status') as StatusFilter | null) ?? null
  );
  const [tagFilter, setTagFilter] = useState<number[]>(
    (searchParams.get('tags') ?? '')
      .split(',')
      .filter(Boolean)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>((searchParams.get('type') as TypeFilter | null) ?? 'all');
  const [sortKey, setSortKey] = useState<SortKey | null>((searchParams.get('sort') as SortKey | null) ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>((searchParams.get('dir') as SortDirection | null) ?? 'desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(Number(searchParams.get('rows') || 15));

  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);
  const [overflowTagAnchor, setOverflowTagAnchor] = useState<HTMLElement | null>(null);

  const pausePrefKey = `pulsebeat.pause-confirm.skip.${user?.id ?? 'anon'}`;

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [m, s, t, mw] = await Promise.all([
        apiGet<EnrichedMonitor[]>('/api/monitors'),
        apiGet<SummaryStats>('/api/summary'),
        apiGet<TagRow[]>('/api/tags'),
        apiGet<{ windows: MaintenanceWindowRow[] }>('/api/maintenance-windows/active'),
      ]);
      setMonitors(m);
      setSummary(s);
      setTags(t);
      setActiveMaint(mw.windows ?? []);
      setLastUpdatedAt(Date.now());
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch), 200);
    return () => clearTimeout(id);
  }, [rawSearch]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('q', search.trim());
    if (statusFilter) next.set('status', statusFilter);
    if (tagFilter.length) next.set('tags', tagFilter.join(','));
    if (typeFilter !== 'all') next.set('type', typeFilter);
    if (sortKey) next.set('sort', sortKey);
    if (sortKey) next.set('dir', sortDir);
    if (rowsPerPage !== 15) next.set('rows', String(rowsPerPage));
    setSearchParams(next, { replace: true });
  }, [search, statusFilter, tagFilter, typeFilter, sortKey, sortDir, rowsPerPage, setSearchParams]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, tagFilter, typeFilter, sortKey, sortDir, rowsPerPage]);

  useEffect(() => {
    setSkipPauseConfirm(localStorage.getItem(pausePrefKey) === '1');
  }, [pausePrefKey]);

  useEffect(() => {
    if (highlightRowId == null) return;
    const id = setTimeout(() => setHighlightRowId(null), 1600);
    return () => clearTimeout(id);
  }, [highlightRowId]);

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = { all: monitors.length, http: 0, tcp: 0, ping: 0, dns: 0 };
    for (const m of monitors) counts[m.type] += 1;
    return counts;
  }, [monitors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = monitors.filter((m) => {
      if (!statusMatches(m, statusFilter)) return false;
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (tagFilter.length) {
        const ids = new Set(m.tags.map((t) => t.id));
        if (!tagFilter.some((id) => ids.has(id))) return false;
      }
      if (q) {
        if (!m.name.toLowerCase().includes(q) && !m.url.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (!sortKey) return rows;
    return rows.slice().sort((a, b) => {
      if (sortKey === 'uptime') {
        const ua = uptime30d(a) ?? -1;
        const ub = uptime30d(b) ?? -1;
        return sortDir === 'desc' ? ub - ua : ua - ub;
      }
      const ta = a.latest?.checked_at ?? 0;
      const tb = b.latest?.checked_at ?? 0;
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [monitors, search, statusFilter, typeFilter, tagFilter, sortKey, sortDir]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const visibleTags = tags.slice(0, 6);
  const overflowTags = tags.slice(6);

  const upCount = monitors.filter((m) => statusFromMonitor(m) === 'up').length;
  const downCount = monitors.filter((m) => statusFromMonitor(m) === 'down').length;
  const pausedCount = monitors.filter((m) => statusFromMonitor(m) === 'paused').length;
  const overallUptime = summary?.total ? (summary.online / summary.total) * 100 : null;

  async function handleCreateMonitor() {
    setAddSaving(true);
    setAddError('');
    try {
      const payload = {
        name: addForm.name.trim(),
        type: addForm.type,
        url: addForm.url.trim(),
        interval: Number(addForm.interval),
        timeout: Number(addForm.timeout),
        retries: Number(addForm.retries),
        check_ssl: addForm.type === 'http' ? addForm.checkSsl : false,
        tag_ids: addForm.tagIds,
      };
      const created = await apiSend<EnrichedMonitor | null>('/api/monitors', 'POST', payload);
      setAddOpen(false);
      setAddForm(initialAddForm());
      await load();
      if (created?.id) setHighlightRowId(created.id);
      setPage(0);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not create monitor');
    } finally {
      setAddSaving(false);
    }
  }

  function openNewTagDialog(target: 'add' | 'quick') {
    setTagDialogTarget(target);
    setNewTagName('');
    setNewTagColour('#4ECB9A');
    setNewTagError('');
    setTagDialogOpen(true);
  }

  async function createTagInline() {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagSaving(true);
    setNewTagError('');
    try {
      const created = await apiSend<TagRow | null>('/api/tags', 'POST', { name, color: newTagColour });
      const refreshedTags = await apiGet<TagRow[]>('/api/tags');
      setTags(refreshedTags);
      if (created?.id) {
        if (tagDialogTarget === 'add') {
          setAddForm((prev) => ({ ...prev, tagIds: prev.tagIds.includes(created.id) ? prev.tagIds : [...prev.tagIds, created.id] }));
        } else {
          setQuickEditTagIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
        }
      }
      setTagDialogOpen(false);
    } catch (e) {
      setNewTagError(e instanceof Error ? e.message : 'Could not create tag');
    } finally {
      setNewTagSaving(false);
    }
  }

  function openQuickEdit(m: EnrichedMonitor) {
    setQuickEditMonitor(m);
    setQuickEditName(m.name);
    setQuickEditInterval(String(m.interval));
    setQuickEditTimeout(String(m.timeout));
    setQuickEditTagIds(m.tag_ids.slice());
  }

  async function saveQuickEdit() {
    if (!quickEditMonitor) return;
    setQuickEditSaving(true);
    try {
      await apiSend(`/api/monitors/${quickEditMonitor.id}`, 'PUT', {
        name: quickEditName.trim(),
        interval: Number(quickEditInterval),
        timeout: Number(quickEditTimeout),
        tag_ids: quickEditTagIds,
      });
      setQuickEditMonitor(null);
      await load();
      setHighlightRowId(quickEditMonitor.id);
    } finally {
      setQuickEditSaving(false);
    }
  }

  async function deleteMonitorConfirmed() {
    if (!quickEditMonitor) return;
    await apiSend(`/api/monitors/${quickEditMonitor.id}`, 'DELETE');
    setDeleteConfirmOpen(false);
    setQuickEditMonitor(null);
    await load();
  }

  async function toggleMonitorActive(m: EnrichedMonitor) {
    if (!m.active) {
      setPauseBusyId(m.id);
      try {
        await apiSend(`/api/monitors/${m.id}`, 'PUT', { active: 1 });
        await load();
        setResumeToast(`Resumed ${m.name}. Next check in ~${m.interval}s.`);
      } finally {
        setPauseBusyId(null);
      }
      return;
    }

    if (skipPauseConfirm) {
      setPauseBusyId(m.id);
      try {
        await apiSend(`/api/monitors/${m.id}`, 'PUT', { active: 0 });
        await load();
      } finally {
        setPauseBusyId(null);
      }
      return;
    }
    setPauseConfirmMonitor(m);
  }

  async function confirmPause() {
    if (!pauseConfirmMonitor) return;
    setPauseBusyId(pauseConfirmMonitor.id);
    try {
      await apiSend(`/api/monitors/${pauseConfirmMonitor.id}`, 'PUT', { active: 0 });
      if (skipPauseConfirm) localStorage.setItem(pausePrefKey, '1');
      await load();
    } finally {
      setPauseBusyId(null);
      setPauseConfirmMonitor(null);
    }
  }

  async function forceCheck(m: EnrichedMonitor) {
    setRefreshBusyId(m.id);
    setForceStatus((prev) => ({ ...prev, [m.id]: { kind: 'checking', message: 'Checking now…' } }));
    try {
      const updated = await apiSend<EnrichedMonitor | null>(`/api/monitors/${m.id}/check`, 'POST');
      if (!updated) {
        await load();
        return;
      }
      setMonitors((prev) => prev.map((row) => (row.id === m.id ? updated : row)));
      if (updated.latest?.status === 1) {
        const msg = `Checked just now · ${updated.latest.latency_ms ?? '—'} ms · HTTP ${parseHttpCode(updated.latest.message)}`;
        setForceStatus((prev) => ({ ...prev, [m.id]: { kind: 'success', message: msg } }));
        setTimeout(() => {
          setForceStatus((prev) => {
            const next = { ...prev };
            delete next[m.id];
            return next;
          });
        }, 3000);
      } else {
        setForceStatus((prev) => ({ ...prev, [m.id]: { kind: 'down', message: `Still down · ${updated.latest?.message ?? 'check failed'}` } }));
      }
      setLastUpdatedAt(Date.now());
    } catch (e) {
      setForceStatus((prev) => ({ ...prev, [m.id]: { kind: 'down', message: `Still down · ${e instanceof Error ? e.message : 'check failed'}` } }));
      await load();
    } finally {
      setRefreshBusyId(null);
    }
  }

  return (
    <Box>
      {activeMaint.length ? (
        <Alert severity="warning" icon={<BuildIcon />} sx={{ mb: 2 }}>
          Maintenance in progress
          {activeMaint.some((w) => w.monitor_id == null) ? ' (all monitors)' : `: ${activeMaint.map((w) => w.name).join(', ')}`}
        </Alert>
      ) : null}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, minHeight: 48 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ lineHeight: 1.1 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated {relativeTime(lastUpdatedAt)} · auto-refreshes every {REFRESH_INTERVAL_SECONDS}s
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add monitor
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: 'OPERATIONAL', value: upCount, status: 'up' as const, clickable: true },
          { label: 'DOWN', value: downCount, status: 'down' as const, clickable: true },
          { label: 'PAUSED', value: pausedCount, status: 'paused' as const, clickable: true },
        ].map((card) => {
          const active = statusFilter === card.status;
          const colour = card.status === 'up' ? 'success.main' : card.status === 'down' ? 'error.main' : 'text.secondary';
          return (
            <GlassCard
              key={card.label}
              onClick={() => setStatusFilter((prev) => (prev === card.status ? null : card.status))}
              sx={{
                p: 1.5,
                cursor: 'pointer',
                borderColor: active ? colour : 'divider',
                backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : undefined,
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colour }} />
                <Typography variant="caption" color="text.secondary">
                  {card.label}
                </Typography>
              </Stack>
              <Typography sx={{ mt: 0.5, fontSize: 24, fontWeight: 500, color: card.value === 0 ? 'text.secondary' : 'text.primary' }}>
                {card.value}
              </Typography>
            </GlassCard>
          );
        })}
        <GlassCard sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            OVERALL UPTIME (30D)
          </Typography>
          <Box sx={{ mt: 1, height: 10, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.2), overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, overallUptime ?? 0))}%`, bgcolor: 'success.main' }} />
          </Box>
          <Typography sx={{ mt: 0.5, color: '#4ECB9A', fontWeight: 600 }}>{overallUptime != null ? `${overallUptime.toFixed(1)}%` : '—'}</Typography>
        </GlassCard>
      </Box>

      <GlassCard sx={{ p: 0 }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', lg: 'center' }}>
            <TextField
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search monitors…"
              size="small"
              sx={{ minWidth: 220, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {visibleTags.map((tag) => {
                const active = tagFilter.includes(tag.id);
                return (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    size="small"
                    onClick={() =>
                      setTagFilter((prev) => (prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))
                    }
                    sx={{
                      borderColor: active ? 'success.main' : 'divider',
                      backgroundColor: active ? alpha(theme.palette.success.main, 0.2) : undefined,
                    }}
                  />
                );
              })}
              {overflowTags.length > 0 ? (
                <Button size="small" variant="outlined" onClick={(e) => setOverflowTagAnchor(e.currentTarget)}>
                  + {overflowTags.length} more
                </Button>
              ) : null}
            </Stack>

            <Button
              size="small"
              variant="outlined"
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(e) => setTypeAnchor(e.currentTarget)}
            >
              {typeFilter === 'all' ? 'Type' : `Type: ${typeLabel(typeFilter as EnrichedMonitor['type'])}`}
            </Button>
          </Stack>

          {(statusFilter || tagFilter.length || typeFilter !== 'all' || search.trim()) ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {statusFilter ? <Chip label={`Status: ${statusFilter.toUpperCase()}`} onDelete={() => setStatusFilter(null)} /> : null}
              {tagFilter.map((id) => {
                const tag = tags.find((t) => t.id === id);
                return <Chip key={id} label={`Tag: ${tag?.name ?? id}`} onDelete={() => setTagFilter((prev) => prev.filter((x) => x !== id))} />;
              })}
              {typeFilter !== 'all' ? <Chip label={`Type: ${typeLabel(typeFilter as EnrichedMonitor['type'])}`} onDelete={() => setTypeFilter('all')} /> : null}
              {search.trim() ? <Chip label={`Search: ${search.trim()}`} onDelete={() => setRawSearch('')} /> : null}
              <Button size="small" onClick={() => { setStatusFilter(null); setTagFilter([]); setTypeFilter('all'); setRawSearch(''); }}>
                Clear all
              </Button>
            </Stack>
          ) : null}
        </Box>

        {isInitialLoading ? (
          <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Monitor</TableCell>
                    <TableCell sx={{ width: 110, cursor: 'pointer' }} onClick={() => {
                      const next = cycleSort('uptime', sortKey, sortDir);
                      setSortKey(next.key);
                      setSortDir(next.dir);
                    }}>
                      Uptime 30d {sortKey === 'uptime' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                    </TableCell>
                    <TableCell sx={{ width: 130 }}>Response trend</TableCell>
                    <TableCell sx={{ width: 140, cursor: 'pointer' }} onClick={() => {
                      const next = cycleSort('lastCheck', sortKey, sortDir);
                      setSortKey(next.key);
                      setSortDir(next.dir);
                    }}>
                      Last check {sortKey === 'lastCheck' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                    </TableCell>
                    <TableCell sx={{ width: 170 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map((m) => {
                    const status = statusFromMonitor(m);
                    const stale = staleMinutes(m);
                    const force = forceStatus[m.id];
                    const url = m.type === 'dns' ? String((m.dns_config as { hostname?: string })?.hostname || m.url) : m.url;
                    const isDown = status === 'down';
                    const uptime = uptime30d(m);
                    const statusColor = status === 'up' ? 'success.main' : status === 'down' ? 'error.main' : stale ? 'warning.main' : 'text.secondary';

                    return (
                      <TableRow
                        key={m.id}
                        hover
                        onClick={() => navigate(`/monitors/${m.id}`)}
                        sx={{
                          cursor: 'pointer',
                          borderLeft: 3,
                          borderLeftColor: stale ? 'warning.main' : statusColor,
                          backgroundColor:
                            highlightRowId === m.id
                              ? alpha(theme.palette.success.main, 0.12)
                              : stale
                                ? alpha(theme.palette.warning.main, 0.08)
                                : status === 'down'
                                  ? alpha(theme.palette.error.main, 0.08)
                                  : undefined,
                          transition: 'background-color 250ms ease',
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ color: statusColor, display: 'inline-flex' }}>{monitorTypeIcon(m.type)}</Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={600} noWrap>
                                {m.name}
                              </Typography>
                              <Typography variant="body2" color={stale ? 'warning.main' : 'text.secondary'} noWrap>
                                {typeLabel(m.type)} · {url}
                                {stale ? ` · check overdue ${stale}m` : ''}
                              </Typography>
                              {force ? (
                                <Typography
                                  variant="body2"
                                  sx={{ color: force.kind === 'down' ? 'error.main' : force.kind === 'success' ? 'success.main' : 'text.secondary' }}
                                >
                                  {force.kind === 'success' ? `✓ ${force.message}` : force.kind === 'down' ? `✗ ${force.message}` : force.message}
                                </Typography>
                              ) : null}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: metricColour(uptime), fontWeight: 500 }}>
                            {uptime != null ? `${uptime.toFixed(1)}%` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', gap: '2px', alignItems: 'end', height: 28, width: 120 }}>
                            {m.recent_checks_30.slice(-12).map((c, idx) => {
                              const h = c.status === 1 ? Math.max(4, ((c.latency_ms ?? 0) / 1000) * 24) : 8;
                              const color = c.status === 1 ? theme.palette.success.main : theme.palette.error.main;
                              return (
                                <Tooltip
                                  key={idx}
                                  arrow
                                  title={
                                    <Box>
                                      <Typography variant="body2">{relativeTime((m.latest?.checked_at ?? Date.now()) - (11 - idx) * m.interval * 1000)}</Typography>
                                      <Typography variant="body2">Status: {c.status === 1 ? 'UP' : 'DOWN'}</Typography>
                                      <Typography variant="body2">Latency: {c.latency_ms ?? '—'} ms</Typography>
                                      <Typography variant="body2">HTTP: {parseHttpCode(m.latest?.message ?? null)}</Typography>
                                    </Box>
                                  }
                                >
                                  <Box sx={{ width: 8, height: Math.min(24, h), bgcolor: color, borderRadius: 0.5 }} />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography color={stale ? 'warning.main' : 'text.primary'}>
                            {m.latest?.checked_at ? relativeTime(m.latest.checked_at) : '—'}
                          </Typography>
                          <Typography variant="body2" color={stale ? 'warning.main' : 'text.secondary'}>
                            {m.latest?.latency_ms != null ? `${m.latest.latency_ms} ms` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                            {status === 'paused' ? (
                              <Button size="small" variant="outlined" onClick={() => void toggleMonitorActive(m)} disabled={pauseBusyId === m.id}>
                                Resume
                              </Button>
                            ) : null}

                            {isDown ? (
                              force?.kind === 'down' ? (
                                <Button size="small" color="error" variant="contained" onClick={() => navigate(`/monitors/${m.id}`)}>
                                  View incident →
                                </Button>
                              ) : (
                                <Button size="small" color="error" variant="contained" onClick={() => void forceCheck(m)} disabled={refreshBusyId === m.id}>
                                  Force check
                                </Button>
                              )
                            ) : (
                              <Tooltip title="Force check">
                                <span>
                                  <IconButton size="small" onClick={() => void forceCheck(m)} disabled={refreshBusyId === m.id}>
                                    <RefreshIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}

                            {status !== 'down' ? (
                              <Tooltip title={m.active ? 'Pause monitor' : 'Resume monitor'}>
                                <span>
                                  <IconButton size="small" onClick={() => void toggleMonitorActive(m)} disabled={pauseBusyId === m.id}>
                                    {m.active ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}

                            <Tooltip title="Settings">
                              <IconButton size="small" onClick={() => openQuickEdit(m)}>
                                <SettingsOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
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
            />
          </>
        )}
      </GlassCard>

      <Menu anchorEl={typeAnchor} open={Boolean(typeAnchor)} onClose={() => setTypeAnchor(null)}>
        {(['all', 'http', 'tcp', 'ping', 'dns'] as TypeFilter[]).map((value) => (
          <MenuItem
            key={value}
            onClick={() => {
              setTypeFilter(value);
              setTypeAnchor(null);
            }}
            sx={{ opacity: value !== 'all' && typeCounts[value] === 0 ? 0.4 : 1 }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: 220 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {typeFilter === value ? <CheckIcon fontSize="small" /> : <Box sx={{ width: 18 }} />}
                <Typography>{value === 'all' ? 'All types' : typeLabel(value as EnrichedMonitor['type'])}</Typography>
              </Stack>
              <Chip label={value === 'all' ? typeCounts.all : typeCounts[value]} size="small" />
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={overflowTagAnchor} open={Boolean(overflowTagAnchor)} onClose={() => setOverflowTagAnchor(null)}>
        {overflowTags.map((tag) => {
          const active = tagFilter.includes(tag.id);
          return (
            <MenuItem
              key={tag.id}
              onClick={() => setTagFilter((prev) => (prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))}
            >
              {active ? <CheckIcon fontSize="small" sx={{ mr: 1 }} /> : <Box sx={{ width: 20, mr: 1 }} />}
              {tag.name}
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add monitor</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              {(['http', 'tcp', 'ping', 'dns'] as EnrichedMonitor['type'][]).map((type) => (
                <Button key={type} variant={addForm.type === type ? 'contained' : 'outlined'} onClick={() => setAddForm((f) => ({ ...f, type }))}>
                  {type.toUpperCase()}
                </Button>
              ))}
            </Stack>
            <TextField label="Name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField
              label={addForm.type === 'http' ? 'URL' : addForm.type === 'tcp' ? 'Host:port' : 'Host'}
              placeholder={
                addForm.type === 'http'
                  ? 'https://example.com/health'
                  : addForm.type === 'tcp'
                    ? '10.0.0.1:443'
                    : addForm.type === 'dns'
                      ? 'example.com'
                      : '1.1.1.1'
              }
              value={addForm.url}
              onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Interval" value={addForm.interval} onChange={(e) => setAddForm((f) => ({ ...f, interval: e.target.value }))} fullWidth>
                {[15, 30, 60, 120, 300].map((n) => (
                  <MenuItem key={n} value={String(n)}>{n}s</MenuItem>
                ))}
              </TextField>
              <TextField select label="Timeout" value={addForm.timeout} onChange={(e) => setAddForm((f) => ({ ...f, timeout: e.target.value }))} fullWidth>
                {[5000, 10000, 15000, 30000].map((n) => (
                  <MenuItem key={n} value={String(n)}>{Math.floor(n / 1000)}s</MenuItem>
                ))}
              </TextField>
            </Stack>
            <FormControl fullWidth>
              <InputLabel id="add-tags">Tags</InputLabel>
              <Select
                labelId="add-tags"
                multiple
                value={addForm.tagIds}
                onChange={(e: SelectChangeEvent<number[]>) =>
                  setAddForm((f) => ({ ...f, tagIds: typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value }))
                }
                input={<OutlinedInput label="Tags" />}
              >
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => openNewTagDialog('add')}>
              + New tag
            </Button>
            <Button onClick={() => setAddForm((f) => ({ ...f, advancedOpen: !f.advancedOpen }))} endIcon={<KeyboardArrowDownIcon />} sx={{ alignSelf: 'flex-start' }}>
              Advanced options
            </Button>
            <Collapse in={addForm.advancedOpen}>
              <Stack spacing={1.25}>
                <TextField label="Headers" placeholder="key: value" value={addForm.headers} onChange={(e) => setAddForm((f) => ({ ...f, headers: e.target.value }))} />
                <TextField label="Auth" placeholder="Bearer token / basic auth" value={addForm.auth} onChange={(e) => setAddForm((f) => ({ ...f, auth: e.target.value }))} />
                <TextField label="Request body" multiline minRows={2} value={addForm.requestBody} onChange={(e) => setAddForm((f) => ({ ...f, requestBody: e.target.value }))} />
                <TextField label="Retries" type="number" value={addForm.retries} onChange={(e) => setAddForm((f) => ({ ...f, retries: e.target.value }))} />
                {addForm.type === 'http' ? (
                  <FormControlLabel control={<Switch checked={addForm.checkSsl} onChange={(e) => setAddForm((f) => ({ ...f, checkSsl: e.target.checked }))} />} label="Validate TLS certificate" />
                ) : null}
              </Stack>
            </Collapse>
            {addError ? <Alert severity="error">{addError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateMonitor()} disabled={addSaving || !addForm.name.trim() || !addForm.url.trim()}>
            Create monitor
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(quickEditMonitor)} onClose={() => setQuickEditMonitor(null)} fullWidth maxWidth="sm">
        <DialogTitle>{quickEditMonitor ? `${quickEditMonitor.name} — settings` : 'Settings'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Quick-edit access to common fields. For advanced options, open the monitor detail page.
            </Typography>
            <TextField label="Name" value={quickEditName} onChange={(e) => setQuickEditName(e.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Interval" value={quickEditInterval} onChange={(e) => setQuickEditInterval(e.target.value)} fullWidth>
                {[15, 30, 60, 120, 300].map((n) => (
                  <MenuItem key={n} value={String(n)}>{n}s</MenuItem>
                ))}
              </TextField>
              <TextField select label="Timeout" value={quickEditTimeout} onChange={(e) => setQuickEditTimeout(e.target.value)} fullWidth>
                {[5000, 10000, 15000, 30000].map((n) => (
                  <MenuItem key={n} value={String(n)}>{Math.floor(n / 1000)}s</MenuItem>
                ))}
              </TextField>
            </Stack>
            <FormControl fullWidth>
              <InputLabel id="quick-tags">Tags</InputLabel>
              <Select
                labelId="quick-tags"
                multiple
                value={quickEditTagIds}
                onChange={(e: SelectChangeEvent<number[]>) => setQuickEditTagIds(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value)}
                input={<OutlinedInput label="Tags" />}
              >
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => openNewTagDialog('quick')}>
              + New tag
            </Button>
            <Box sx={{ border: 1, borderColor: 'error.main', borderRadius: 1, p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08) }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography color="error.main">Delete this monitor permanently</Typography>
                <Button color="error" variant="outlined" onClick={() => setDeleteConfirmOpen(true)}>
                  Delete
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickEditMonitor(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void saveQuickEdit()}
            disabled={
              quickEditSaving ||
              !quickEditMonitor ||
              (quickEditName.trim() === quickEditMonitor.name &&
                quickEditInterval === String(quickEditMonitor.interval) &&
                quickEditTimeout === String(quickEditMonitor.timeout) &&
                quickEditTagIds.join(',') === quickEditMonitor.tag_ids.join(','))
            }
          >
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete monitor?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently delete {quickEditMonitor?.name}. This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void deleteMonitorConfirmed()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pauseConfirmMonitor)} onClose={() => setPauseConfirmMonitor(null)}>
        <DialogTitle>Pause {pauseConfirmMonitor?.name}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            While paused, this monitor will not be checked and no alerts will be sent. Uptime statistics remain intact.
          </Typography>
          <FormControlLabel control={<Switch checked={skipPauseConfirm} onChange={(e) => setSkipPauseConfirm(e.target.checked)} />} label="Don't ask again for pause actions" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseConfirmMonitor(null)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={() => void confirmPause()}>
            Pause monitor
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New tag</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} required />
            <TextField
              label="Colour"
              type="color"
              value={newTagColour}
              onChange={(e) => setNewTagColour(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            {newTagError ? <Alert severity="error">{newTagError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void createTagInline()} disabled={newTagSaving || !newTagName.trim()}>
            Create tag
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(resumeToast)}
        autoHideDuration={5000}
        onClose={() => setResumeToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          icon={<CheckIcon fontSize="small" />}
          action={
            <IconButton size="small" onClick={() => setResumeToast('')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{ borderLeft: 3, borderLeftColor: 'success.main' }}
        >
          {resumeToast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
