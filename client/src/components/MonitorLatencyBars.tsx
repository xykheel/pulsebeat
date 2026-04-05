import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const W = 120;
const H = 40;

export default function MonitorLatencyBars({ checks }: { checks: { status: number; latency_ms: number | null }[] }) {
  const theme = useTheme();
  const up = theme.palette.status.online;
  const down = theme.palette.status.offline;
  const latencies = checks
    .map((c) => c.latency_ms)
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  const maxLat = latencies.length ? Math.max(...latencies, 1) : 1;
  const n = checks.length || 1;
  const gap = 1;
  const barW = Math.max(1, (W - 4 - (n - 1) * gap) / n);

  return (
    <Box sx={{ width: W, height: H, opacity: checks.length ? 1 : 0.35 }} aria-hidden>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {checks.map((c, i) => {
          const x = 2 + i * (barW + gap);
          const colour = c.status === 1 ? up : down;
          const lat = typeof c.latency_ms === 'number' ? c.latency_ms : 0;
          const h =
            c.status === 1 && c.latency_ms != null ? Math.max(2, (lat / maxLat) * (H - 6)) : H * 0.35;
          const y = H - 2 - h;
          return <rect key={i} x={x} y={y} width={barW} height={h} rx={0.5} fill={colour} opacity={0.9} />;
        })}
      </svg>
    </Box>
  );
}
