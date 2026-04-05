import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, IconButton, Link, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import GlassCard from './GlassCard';
import StatusPulse from './StatusPulse';
import Sparkline from './Sparkline';
import UptimeBar90 from './UptimeBar90';
import { horizontalScrollThinSx, monitorStateChipSx } from '../theme';
import type { EnrichedMonitor } from '../types';

function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(2)}%`;
}

function fmtMs(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v} ms`;
}

export default function MonitorCard({
  monitor,
  onEdit,
}: {
  monitor: EnrichedMonitor;
  onEdit: (m: EnrichedMonitor) => void;
}) {
  const theme = useTheme();
  const up = monitor.latest?.status === 1;
  const inactive = !monitor.active;
  const chipState = inactive ? 'paused' : up ? 'online' : 'offline';

  return (
    <GlassCard
      sx={{
        p: { xs: 2, sm: 2.25 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box display="flex" alignItems="center" gap={1.5} minWidth={0}>
          {inactive ? (
            <Box
              sx={(t) => ({
                width: 14,
                height: 14,
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: t.palette.status.inactive,
              })}
            />
          ) : (
            <StatusPulse up={up} />
          )}
          <Box minWidth={0}>
            <Link
              component={RouterLink}
              to={`/monitors/${monitor.id}`}
              underline="hover"
              color="inherit"
              sx={{ fontWeight: 700, fontSize: '1.05rem', display: 'block' }}
              noWrap
            >
              {monitor.name}
            </Link>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {monitor.type.toUpperCase()} · {monitor.url}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={() => onEdit(monitor)} aria-label="Edit monitor">
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={inactive ? 'Paused' : up ? 'Online' : 'Offline'}
          sx={monitorStateChipSx(theme, chipState)}
        />
        <Chip
          size="small"
          label={`90d ${fmtPct(monitor.uptime_pct_90d)}`}
          sx={{
            typography: 'captionMono',
            fontSize: '0.7rem',
            height: 22,
          }}
        />
        <Chip
          size="small"
          label={`avg ${fmtMs(monitor.avg_latency_ms)}`}
          sx={{
            typography: 'captionMono',
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      </Stack>

      <Box
        mt={2}
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        gap={{ xs: 2, sm: 1 }}
        flexGrow={1}
      >
        <Box sx={{ minWidth: 0, flex: { sm: '1 1 auto' } }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            90-day uptime
          </Typography>
          <Box sx={horizontalScrollThinSx()}>
            <UptimeBar90 bars={monitor.daily_bars} />
          </Box>
        </Box>
        <Box
          textAlign={{ xs: 'left', sm: 'right' }}
          sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
        >
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Response
          </Typography>
          <Sparkline values={monitor.sparkline} width={112} height={36} />
        </Box>
      </Box>
    </GlassCard>
  );
}
