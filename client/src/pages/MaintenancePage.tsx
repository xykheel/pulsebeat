import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import type { EnrichedMonitor, MaintenanceWindowRow } from '../types';

const ZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'UTC',
  'Europe/London',
  'America/New_York',
];

function classify(
  w: MaintenanceWindowRow,
  now: number
): { label: string; tone: 'warning' | 'info' | 'default' } {
  if (!w.active) return { label: 'Inactive', tone: 'default' };
  if (w.recurring) {
    return { label: 'Recurring', tone: 'warning' };
  }
  if (now >= w.starts_at && now < w.ends_at) return { label: 'Active', tone: 'warning' };
  if (w.starts_at > now) return { label: 'Upcoming', tone: 'info' };
  return { label: 'Ended', tone: 'default' };
}

export default function MaintenancePage() {
  const [rows, setRows] = useState<MaintenanceWindowRow[]>([]);
  const [monitors, setMonitors] = useState<EnrichedMonitor[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<MaintenanceWindowRow | null>(null);
  const [form, setForm] = useState({
    name: '',
    apply_all: true,
    monitor_ids: [] as number[],
    starts_at: '',
    ends_at: '',
    recurring: false,
    cron_expression: '',
    timezone: 'Australia/Sydney',
    active: true,
  });

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [w, m] = await Promise.all([
        apiGet<MaintenanceWindowRow[]>('/api/maintenance-windows'),
        apiGet<EnrichedMonitor[]>('/api/monitors'),
      ]);
      setRows(w);
      setMonitors(m);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEdit(null);
    const now = new Date();
    const later = new Date(now.getTime() + 3600000);
    const toLocal = (d: Date) => {
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - off).toISOString().slice(0, 16);
    };
    setForm({
      name: '',
      apply_all: true,
      monitor_ids: [],
      starts_at: toLocal(now),
      ends_at: toLocal(later),
      recurring: false,
      cron_expression: '',
      timezone: 'Australia/Sydney',
      active: true,
    });
    setOpen(true);
  }

  function openEdit(w: MaintenanceWindowRow) {
    setEdit(w);
    const toLocal = (ms: number) => {
      const d = new Date(ms);
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - off).toISOString().slice(0, 16);
    };
    setForm({
      name: w.name,
      apply_all: w.monitor_id == null,
      monitor_ids: w.monitor_id != null ? [w.monitor_id] : [],
      starts_at: toLocal(w.starts_at),
      ends_at: toLocal(w.ends_at),
      recurring: w.recurring === 1,
      cron_expression: w.cron_expression || '',
      timezone: w.timezone || 'Australia/Sydney',
      active: w.active === 1,
    });
    setOpen(true);
  }

  function parseLocal(s: string): number {
    const d = new Date(s);
    return d.getTime();
  }

  async function save() {
    setError('');
    const starts_at = parseLocal(form.starts_at);
    const ends_at = parseLocal(form.ends_at);
    if (!Number.isFinite(starts_at) || !Number.isFinite(ends_at) || ends_at <= starts_at) {
      setError('Invalid start or end time');
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      starts_at,
      ends_at,
      recurring: form.recurring,
      cron_expression: form.recurring ? form.cron_expression.trim() : null,
      timezone: form.timezone,
      active: form.active,
    };
    if (form.apply_all) {
      body.apply_all = true;
    } else if (form.monitor_ids.length) {
      body.monitor_ids = form.monitor_ids;
    } else {
      setError('Select monitors or all monitors');
      return;
    }
    try {
      if (edit) {
        await apiSend(`/api/maintenance-windows/${edit.id}`, 'PUT', {
          name: body.name,
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          recurring: body.recurring,
          cron_expression: body.cron_expression,
          timezone: body.timezone,
          active: body.active,
          monitor_id: form.apply_all ? null : form.monitor_ids[0] ?? null,
        });
      } else {
        await apiSend('/api/maintenance-windows', 'POST', body);
      }
      setOpen(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function delRow(id: number) {
    if (!window.confirm('Delete this maintenance window?')) return;
    try {
      await apiSend(`/api/maintenance-windows/${id}`, 'DELETE');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const now = Date.now();
  const onMonSel = (e: SelectChangeEvent<number[]>) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      monitor_ids: typeof v === 'string' ? v.split(',').map(Number) : v,
    }));
  };

  return (
    <Box>
      <Box className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Box className="flex items-center gap-2">
          <BuildIcon className="text-pb-primary text-[2rem] shrink-0" aria-hidden />
          <Typography variant="h4" component="h1" className="tracking-tight">
            Maintenance
          </Typography>
        </Box>
        <Button variant="contained" onClick={openNew}>
          New window
        </Button>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>State</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No maintenance windows yet.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((w) => {
                const st = classify(w, now);
                return (
                  <TableRow key={w.id} hover>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>
                      {w.monitor_id == null ? (
                        <Chip size="small" label="All monitors" />
                      ) : (
                        <Typography variant="body2">
                          {monitors.find((m) => m.id === w.monitor_id)?.name || `Monitor #${w.monitor_id}`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ typography: 'caption' }}>
                      {w.recurring ? (
                        <>
                          Recurring · <code>{w.cron_expression}</code> · {w.timezone}
                        </>
                      ) : (
                        <>
                          {new Date(w.starts_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} →{' '}
                          {new Date(w.ends_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={st.label}
                        color={st.tone === 'default' ? undefined : st.tone}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(w)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => void delRow(w.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </GlassCard>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{edit ? 'Edit maintenance window' : 'New maintenance window'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.apply_all}
                  onChange={(e) => setForm((f) => ({ ...f, apply_all: e.target.checked }))}
                />
              }
              label="Apply to all monitors"
            />
            {!form.apply_all ? (
              <FormControl fullWidth>
                <InputLabel id="mw-mon">Monitors</InputLabel>
                <Select
                  labelId="mw-mon"
                  multiple
                  value={form.monitor_ids}
                  onChange={onMonSel}
                  input={<OutlinedInput label="Monitors" />}
                  renderValue={(sel) =>
                    (sel as number[])
                      .map((id) => monitors.find((m) => m.id === id)?.name || String(id))
                      .join(', ')
                  }
                >
                  {monitors.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <TextField
              label="Start (local)"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End (local)"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.recurring}
                  onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                />
              }
              label="Recurring (cron)"
            />
            {form.recurring ? (
              <>
                <TextField
                  label="Cron expression"
                  value={form.cron_expression}
                  onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  fullWidth
                  placeholder="0 2 * * 0"
                  helperText="Uses server cron-parser; timezone below applies."
                />
                <TextField
                  select
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  fullWidth
                >
                  {ZONES.map((z) => (
                    <MenuItem key={z} value={z}>
                      {z}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!form.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
