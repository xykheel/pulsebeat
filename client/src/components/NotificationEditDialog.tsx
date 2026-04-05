import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { apiSend } from '../api';
import NotificationConfigFields from './NotificationConfigFields';
import type { NotificationItem } from '../types';

const TYPES = [
  'telegram',
  'discord',
  'slack',
  'smtp',
  'webhook',
  'teams',
  'pushover',
  'pushbullet',
  'pagerduty',
  'gotify',
  'ntfy',
  'signal',
  'rocketchat',
  'matrix',
  'twilio',
  'apprise',
] as const;

interface NotifFormState {
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

function emptyForm(): NotifFormState {
  return {
    name: '',
    type: 'discord',
    config: {},
    enabled: true,
  };
}

export default function NotificationEditDialog({
  open,
  onClose,
  editing,
  onSaved,
  inlineError,
}: {
  open: boolean;
  onClose: () => void;
  editing: NotificationItem | null;
  onSaved: () => void;
  /** When set, shown inside the dialog (e.g. from parent list actions). */
  inlineError?: string;
}) {
  const [form, setForm] = useState<NotifFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        config: { ...editing.config },
        enabled: !!editing.enabled,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editing]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        type: form.type,
        config: form.config,
        enabled: form.enabled,
      };
      if (editing) {
        await apiSend(`/api/notifications/${editing.id}`, 'PUT', payload);
      } else {
        await apiSend('/api/notifications', 'POST', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const showError = error || inlineError;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Edit notification' : 'Add notification'}</DialogTitle>
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
            label="Provider"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, config: {} }))}
            fullWidth
          >
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <NotificationConfigFields
            type={form.type}
            config={form.config}
            onChange={(config) => setForm((f) => ({ ...f, config }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
            }
            label="Enabled"
          />
          {showError ? <Alert severity="error">{showError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || !form.name}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
