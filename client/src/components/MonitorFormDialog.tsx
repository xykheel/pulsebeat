import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
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
  TextField,
} from '@mui/material';
import { apiSend } from '../api';
import type { EnrichedMonitor, MonitorType, NotificationItem } from '../types';

type FormState = {
  name: string;
  type: MonitorType;
  url: string;
  interval: string;
  timeout: string;
  retries: string;
  active: boolean;
  notification_ids: number[];
};

function initialEmpty(): FormState {
  return {
    name: '',
    type: 'http',
    url: '',
    interval: '60',
    timeout: '10000',
    retries: '0',
    active: true,
    notification_ids: [],
  };
}

export default function MonitorFormDialog({
  open,
  onClose,
  monitor,
  notifications,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  monitor: EnrichedMonitor | null;
  notifications: NotificationItem[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (monitor) {
      setForm({
        name: monitor.name,
        type: monitor.type,
        url: monitor.url,
        interval: String(monitor.interval),
        timeout: String(monitor.timeout),
        retries: String(monitor.retries),
        active: !!monitor.active,
        notification_ids: monitor.notification_ids || [],
      });
    } else {
      setForm(initialEmpty());
    }
  }, [open, monitor]);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        type: form.type,
        url: form.url,
        interval: Number(form.interval),
        timeout: Number(form.timeout),
        retries: Number(form.retries),
        active: form.active,
        notification_ids: form.notification_ids,
      };
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

  return (
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
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as MonitorType }))
            }
            fullWidth
          >
            <MenuItem value="http">HTTP</MenuItem>
            <MenuItem value="tcp">TCP</MenuItem>
            <MenuItem value="ping">Ping</MenuItem>
          </TextField>
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
        <Button variant="contained" onClick={() => void submit()} disabled={saving || !form.name || !form.url}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
