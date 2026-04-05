import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import { apiGet } from '../api';
import SummaryBar from '../components/SummaryBar';
import MonitorCard from '../components/MonitorCard';
import MonitorFormDialog from '../components/MonitorFormDialog';
import type { EnrichedMonitor, NotificationItem, SummaryStats } from '../types';

export default function Dashboard() {
  const [monitors, setMonitors] = useState<EnrichedMonitor[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMonitor, setEditMonitor] = useState<EnrichedMonitor | null>(null);

  const load = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [m, n, s] = await Promise.all([
        apiGet<EnrichedMonitor[]>('/api/monitors'),
        apiGet<NotificationItem[]>('/api/notifications'),
        apiGet<SummaryStats>('/api/summary'),
      ]);
      setMonitors(m);
      setNotifications(n);
      setSummary(s);
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

  function openAdd() {
    setEditMonitor(null);
    setDialogOpen(true);
  }

  function openEdit(m: EnrichedMonitor) {
    setEditMonitor(m);
    setDialogOpen(true);
  }

  return (
    <Box>
      <Box className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Box className="flex items-center gap-2">
          <ViewListOutlinedIcon className="text-pb-primary text-[2rem] shrink-0" aria-hidden />
          <Typography variant="h4" component="h1" className="tracking-tight">
            Monitors
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          className="w-full shrink-0 whitespace-nowrap sm:w-auto"
        >
          Add monitor
        </Button>
      </Box>

      <SummaryBar summary={summary} />

      {!monitors.length ? (
        <Typography color="text.secondary" className="mt-8 text-white/55">
          No monitors yet. Add one to begin tracking uptime.
        </Typography>
      ) : (
        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          {monitors.map((m) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={m.id}>
              <MonitorCard monitor={m} onEdit={openEdit} />
            </Grid>
          ))}
        </Grid>
      )}

      <MonitorFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        monitor={editMonitor}
        notifications={notifications}
        onSaved={load}
      />
    </Box>
  );
}
