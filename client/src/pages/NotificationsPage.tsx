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
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { apiGet, apiSend } from '../api';
import GlassCard from '../components/GlassCard';
import NotificationConfigFields from '../components/NotificationConfigFields';
import { listRowDividerSx } from '../theme';
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

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationItem | null>(null);
  const [form, setForm] = useState<NotifFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testId, setTestId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const list = await apiGet<NotificationItem[]>('/api/notifications');
      setItems(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setOpen(true);
  }

  function openEdit(n: NotificationItem) {
    setEditing(n);
    setForm({
      name: n.name,
      type: n.type,
      config: { ...n.config },
      enabled: !!n.enabled,
    });
    setError('');
    setOpen(true);
  }

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
      setOpen(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(n: NotificationItem) {
    if (!window.confirm(`Delete notification “${n.name}”?`)) return;
    try {
      await apiSend(`/api/notifications/${n.id}`, 'DELETE');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function test(n: NotificationItem) {
    setTestId(n.id);
    setError('');
    try {
      await apiSend(`/api/notifications/${n.id}/test`, 'POST');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestId(null);
    }
  }

  return (
    <Box>
      <Box className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <Box className="flex items-center gap-2">
          <NotificationsOutlinedIcon className="text-pb-primary text-[2rem] shrink-0" aria-hidden />
          <Typography variant="h4" component="h1" className="tracking-tight">
            Notifications
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add notification
        </Button>
      </Box>

      {error && !open ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GlassCard sx={{ p: 0 }}>
        {!items.length ? (
          <Box p={3}>
            <Typography color="text.secondary">No notification channels configured.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((n) => (
              <ListItem
                key={n.id}
                sx={{
                  ...listRowDividerSx(),
                  py: 2,
                  px: 2.5,
                }}
              >
                <ListItemText
                  primary={n.name}
                  primaryTypographyProps={{ fontWeight: 600 }}
                  secondary={`${n.type} · ${n.enabled ? 'enabled' : 'disabled'}`}
                  secondaryTypographyProps={{ variant: 'captionMono', color: 'text.secondary' }}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="Test" onClick={() => void test(n)} disabled={testId === n.id}>
                    <SendIcon fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" aria-label="Edit" onClick={() => openEdit(n)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" aria-label="Delete" onClick={() => void remove(n)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </GlassCard>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
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
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving || !form.name}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
