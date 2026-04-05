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
        justifyContent: 'flex-start',
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
        sx={{
          mt: 1.75,
          pt: 1.75,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          gap: { xs: 2, sm: 2.5 },
        }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 0%' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{
              m: 0,
              mb: 0.75,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.65rem',
            }}
          >
            90-day uptime
          </Typography>
          <Box sx={horizontalScrollThinSx()}>
            <UptimeBar90 bars={monitor.daily_bars} />
          </Box>
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            minWidth: { sm: 128 },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{
              m: 0,
              mb: 0.75,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.65rem',
              textAlign: { xs: 'left', sm: 'right' },
            }}
          >
            Response
          </Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            }}
          >
            <Sparkline values={monitor.sparkline} width={120} height={40} />
          </Box>
        </Box>
      </Box>
    </GlassCard>
  );
}
