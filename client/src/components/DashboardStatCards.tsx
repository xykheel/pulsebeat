import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GlassCard from './GlassCard';
import Sparkline from './Sparkline';
import type { SummaryStats } from '../types';

export default function DashboardStatCards({ summary }: { summary: SummaryStats | null }) {
  const theme = useTheme();
  if (!summary) return null;

  const up = summary.up ?? summary.online;
  const down = summary.down ?? summary.offline;
  const paused =
    summary.paused ??
    Math.max(0, summary.total - summary.online - summary.offline);

  const cards = [
    {
      label: 'UP',
      value: up,
      colour: theme.palette.status.online,
      spark: summary.sparkline_up ?? [],
    },
    {
      label: 'DOWN',
      value: down,
      colour: theme.palette.status.offline,
      spark: summary.sparkline_down ?? [],
    },
    {
      label: 'PAUSED',
      value: paused,
      colour: theme.palette.status.inactive,
      spark: summary.sparkline_paused ?? Array(24).fill(paused),
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
        mb: 3,
      }}
    >
      {cards.map((c) => (
        <GlassCard
          key={c.label}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            px: 2.5,
            py: 2,
            minHeight: 100,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.12,
              pointerEvents: 'none',
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${c.colour}22 50%, transparent 100%)`,
            }}
          />
          <Box sx={{ position: 'absolute', right: 8, bottom: 4, opacity: 0.35 }} aria-hidden>
            <Sparkline values={c.spark.map((v) => v)} height={44} width={140} colour={c.colour} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ position: 'relative', fontWeight: 600 }}>
            {c.label}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              position: 'relative',
              mt: 0.5,
              fontFamily: theme.typography.data.fontFamily,
              fontWeight: 700,
              color: c.colour,
              lineHeight: 1.1,
            }}
          >
            {c.value}
          </Typography>
        </GlassCard>
      ))}
    </Box>
  );
}
