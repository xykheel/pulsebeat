import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GlassCard from './GlassCard';
import type { SummaryStats } from '../types';

export default function SummaryBar({ summary }: { summary: SummaryStats | null }) {
  const theme = useTheme();
  if (!summary) return null;
  const items = [
    { label: 'Total', value: summary.total, colour: 'text.primary' as const },
    { label: 'Online', value: summary.online, colour: theme.palette.status.online },
    { label: 'Offline', value: summary.offline, colour: theme.palette.status.offline },
    {
      label: 'Avg response',
      value: summary.avgResponseMs != null ? `${summary.avgResponseMs} ms` : '—',
      colour: theme.palette.primary.main,
    },
  ];
  return (
    <GlassCard sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 2, sm: 2.5, md: 3 },
          alignItems: 'start',
        }}
      >
        {items.map((it) => (
          <Box key={it.label} sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {it.label}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontFamily: theme.typography.data.fontFamily,
                fontWeight: 600,
                color: it.colour,
                mt: 0.25,
                fontSize: { xs: '1.15rem', sm: '1.35rem' },
              }}
            >
              {it.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}
