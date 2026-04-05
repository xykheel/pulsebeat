import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { apiGet, apiSend } from '../api';
import type { DnsConfig, EnrichedMonitor, MonitorType, NotificationItem, TagRow } from '../types';

type FormState = {
  name: string;
  type: MonitorType;
  url: string;
  interval: string;
  timeout: string;
  retries: string;
  active: boolean;
  check_ssl: boolean;
  notification_ids: number[];
  tag_ids: number[];
  dns_hostname: string;
  dns_expected_ip: string;
  dns_resolver: string;
  dns_record_type: string;
};

function dnsFromMonitor(m: EnrichedMonitor | null): Pick<FormState, 'dns_hostname' | 'dns_expected_ip' | 'dns_resolver' | 'dns_record_type'> {
  if (!m || m.type !== 'dns') {
    return {
      dns_hostname: '',
      dns_expected_ip: '',
      dns_resolver: '',
      dns_record_type: 'A',
    };
  }
  const c = m.dns_config as DnsConfig;
  return {
    dns_hostname: String(c.hostname || m.url || ''),
    dns_expected_ip: String(c.expected_ip || ''),
    dns_resolver: String(c.resolver || ''),
    dns_record_type: String(c.record_type || 'A').toUpperCase(),
  };
}

function initialEmpty(): FormState {
  return {
    name: '',
    type: 'http',
    url: '',
    interval: '60',
    timeout: '10000',
    retries: '0',
    active: true,
    check_ssl: false,
    notification_ids: [],
    tag_ids: [],
    dns_hostname: '',
    dns_expected_ip: '',
    dns_resolver: '',
    dns_record_type: 'A',
  };
}

export default function MonitorFormDialog({
  open,
  onClose,
  monitor,
  notifications,
  tags,
  onSaved,
  onTagsChanged,
}: {
  open: boolean;
  onClose: () => void;
  monitor: EnrichedMonitor | null;
  notifications: NotificationItem[];
  tags: TagRow[];
  onSaved: () => void;
  onTagsChanged?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [localTags, setLocalTags] = useState<TagRow[]>([]);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [tagDlg, setTagDlg] = useState<{ open: boolean; edit: TagRow | null }>({ open: false, edit: null });
  const [tagForm, setTagForm] = useState({ name: '', color: '#6366f1' });
  const [tagError, setTagError] = useState('');

  const refreshTags = useCallback(async () => {
    try {
      const t = await apiGet<TagRow[]>('/api/tags');
      setLocalTags(t);
    } catch {
      /* ignore; keep previous list */
    }
    onTagsChanged?.();
  }, [onTagsChanged]);

  useEffect(() => {
    if (!open) return;
    setLocalTags(tags);
  }, [open, tags]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (monitor) {
      const d = dnsFromMonitor(monitor);
      setForm({
        name: monitor.name,
        type: monitor.type,
        url: monitor.url,
        interval: String(monitor.interval),
        timeout: String(monitor.timeout),
        retries: String(monitor.retries),
        active: !!monitor.active,
        check_ssl: !!(monitor.check_ssl ?? 0),
        notification_ids: monitor.notification_ids || [],
        tag_ids: monitor.tag_ids || [],
        ...d,
      });
    } else {
      setForm(initialEmpty());
    }
  }, [open, monitor]);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const isDns = form.type === 'dns';
      const hostname = form.dns_hostname.trim() || form.url.trim();
      const dns_config = isDns
        ? {
            hostname,
            expected_ip: form.dns_expected_ip.trim(),
            resolver: form.dns_resolver.trim(),
            record_type: form.dns_record_type || 'A',
          }
        : undefined;
      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        url: isDns ? hostname : form.url,
        interval: Number(form.interval),
        timeout: Number(form.timeout),
        retries: Number(form.retries),
        active: form.active,
        check_ssl: form.type === 'http' ? form.check_ssl : false,
        notification_ids: form.notification_ids,
        tag_ids: form.tag_ids,
      };
      if (isDns) {
        payload.dns_config = dns_config;
      }
      if (monitor) {
        await apiSend(`/api/monitors/${monitor.id}`, 'PUT', payload);
      } else {
        await apiSend('/api/monitors', 'POST', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function onNotifChange(e: SelectChangeEvent<number[]>) {
    const value = e.target.value;
    const ids = typeof value === 'string' ? value.split(',').map(Number) : value;
    setForm((f) => ({ ...f, notification_ids: ids }));
  }

  function onTagChange(e: SelectChangeEvent<number[]>) {
    const value = e.target.value;
    const ids = typeof value === 'string' ? value.split(',').map(Number) : value;
    setForm((f) => ({ ...f, tag_ids: ids }));
  }

  async function saveTag() {
    setTagError('');
    try {
      if (tagDlg.edit) {
        await apiSend(`/api/tags/${tagDlg.edit.id}`, 'PUT', {
          name: tagForm.name.trim(),
          color: tagForm.color,
        });
      } else {
        await apiSend('/api/tags', 'POST', { name: tagForm.name.trim(), color: tagForm.color });
      }
      setTagDlg({ open: false, edit: null });
      await refreshTags();
    } catch (e) {
      setTagError(e instanceof Error ? e.message : 'Tag save failed');
    }
  }

  async function deleteTagRow(id: number) {
    if (!window.confirm('Delete this tag? It will be removed from all monitors.')) return;
    setTagError('');
    try {
      await apiSend(`/api/tags/${id}`, 'DELETE');
      setForm((f) => ({ ...f, tag_ids: f.tag_ids.filter((x) => x !== id) }));
      await refreshTags();
    } catch (e) {
      setTagError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function openNewTag() {
    setTagForm({ name: '', color: '#6366f1' });
    setTagDlg({ open: true, edit: null });
    setTagError('');
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{monitor ? 'Edit monitor' : 'Add monitor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MonitorType }))}
              fullWidth
            >
              <MenuItem value="http">HTTP</MenuItem>
              <MenuItem value="tcp">TCP</MenuItem>
              <MenuItem value="ping">Ping</MenuItem>
              <MenuItem value="dns">DNS</MenuItem>
            </TextField>
            {form.type === 'http' ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.check_ssl}
                    onChange={(e) => setForm((f) => ({ ...f, check_ssl: e.target.checked }))}
                  />
                }
                label="Validate TLS certificate (HTTPS only)"
              />
            ) : null}
            {form.type === 'dns' ? (
              <>
                <TextField
                  label="Hostname to resolve"
                  value={form.dns_hostname}
                  onChange={(e) => setForm((f) => ({ ...f, dns_hostname: e.target.value }))}
                  fullWidth
                  required
                  placeholder="example.com"
                />
                <TextField
                  select
                  label="Record type"
                  value={form.dns_record_type}
                  onChange={(e) => setForm((f) => ({ ...f, dns_record_type: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="AAAA">AAAA</MenuItem>
                  <MenuItem value="CNAME">CNAME</MenuItem>
                  <MenuItem value="MX">MX</MenuItem>
                  <MenuItem value="TXT">TXT</MenuItem>
                </TextField>
                <TextField
                  label="Expected value (optional)"
                  value={form.dns_expected_ip}
                  onChange={(e) => setForm((f) => ({ ...f, dns_expected_ip: e.target.value }))}
                  fullWidth
                  placeholder="IP, MX host, or substring to match"
                />
                <TextField
                  label="Custom resolver (optional)"
                  value={form.dns_resolver}
                  onChange={(e) => setForm((f) => ({ ...f, dns_resolver: e.target.value }))}
                  fullWidth
                  placeholder="e.g. 1.1.1.1"
                />
              </>
            ) : (
              <TextField
                label={form.type === 'http' ? 'URL' : form.type === 'tcp' ? 'Host:port' : 'Hostname'}
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                fullWidth
                required
                placeholder={
                  form.type === 'http'
                    ? 'https://example.com/health'
                    : form.type === 'tcp'
                      ? '10.0.0.1:443'
                      : '1.1.1.1'
                }
              />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Interval (sec)"
                type="number"
                value={form.interval}
                onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
                fullWidth
                inputProps={{ min: 5, max: 86400 }}
              />
              <TextField
                label="Timeout (ms)"
                type="number"
                value={form.timeout}
                onChange={(e) => setForm((f) => ({ ...f, timeout: e.target.value }))}
                fullWidth
                inputProps={{ min: 1000, max: 120000 }}
              />
              <TextField
                label="Retries"
                type="number"
                value={form.retries}
                onChange={(e) => setForm((f) => ({ ...f, retries: e.target.value }))}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel id="nf-label">Notifications</InputLabel>
              <Select
                labelId="nf-label"
                multiple
                value={form.notification_ids}
                onChange={onNotifChange}
                input={<OutlinedInput label="Notifications" />}
                renderValue={(selected) =>
                  (selected as number[])
                    .map((id) => notifications.find((n) => n.id === id)?.name || String(id))
                    .join(', ')
                }
              >
                {notifications.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.name} ({n.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="tg-label">Tags</InputLabel>
              <Select
                labelId="tg-label"
                multiple
                value={form.tag_ids}
                onChange={onTagChange}
                input={<OutlinedInput label="Tags" />}
                renderValue={(selected) =>
                  (selected as number[])
                    .map((id) => localTags.find((t) => t.id === id)?.name || String(id))
                    .join(', ')
                }
              >
                {localTags.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openNewTag}>
                New tag
              </Button>
              <Button size="small" variant="text" onClick={() => setManageTagsOpen(true)}>
                Manage tags
              </Button>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
              }
              label="Active"
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={
              saving ||
              !form.name ||
              (form.type === 'dns' ? !form.dns_hostname.trim() && !form.url.trim() : !form.url)
            }
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={manageTagsOpen}
        onClose={() => {
          setManageTagsOpen(false);
          setTagError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage tags</DialogTitle>
        <DialogContent>
          {tagError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {tagError}
            </Alert>
          ) : null}
          <Button startIcon={<AddIcon />} variant="outlined" sx={{ mb: 2 }} onClick={openNewTag}>
            New tag
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colour</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!localTags.length ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      No tags yet.
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                localTags.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          bgcolor: t.color,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      />
                    </TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label="Edit tag"
                        onClick={() => {
                          setTagForm({ name: t.name, color: t.color });
                          setTagDlg({ open: true, edit: t });
                          setTagError('');
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Delete tag"
                        color="error"
                        onClick={() => void deleteTagRow(t.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setManageTagsOpen(false);
              setTagError('');
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={tagDlg.open}
        onClose={() => setTagDlg({ open: false, edit: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{tagDlg.edit ? 'Edit tag' : 'New tag'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={tagForm.name}
              onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Colour"
              type="color"
              value={tagForm.color}
              onChange={(e) => setTagForm((f) => ({ ...f, color: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            {tagError ? <Alert severity="error">{tagError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTagDlg({ open: false, edit: null })}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveTag()} disabled={!tagForm.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
