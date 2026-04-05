import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { HeartbeatPoint } from '../types';

export default function ResponseTimeChart({
  points,
  height = 220,
}: {
  points: HeartbeatPoint[];
  height?: number;
}) {
  const theme = useTheme();
  const w = 800;
  const h = height;
  const pad = { t: 12, r: 12, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const fontMono = theme.typography.dataSmall.fontFamily;
  const axisFill = theme.palette.text.muted;

  const data = points.filter(
    (p): p is HeartbeatPoint & { latency_ms: number } =>
      p.status === 1 && p.latency_ms != null
  );
  if (!data.length) {
    return (
      <Box sx={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">No response time data yet</Typography>
      </Box>
    );
  }

  const lat = data.map((p) => p.latency_ms);
  const min = Math.min(...lat);
  const max = Math.max(...lat);
  const span = max - min || 1;
  const t0 = data[0].checked_at;
  const t1 = data[data.length - 1].checked_at;
  const tSpan = Math.max(1, t1 - t0);

  const path = data
    .map((p, i) => {
      const x = pad.l + ((p.checked_at - t0) / tSpan) * innerW;
      const y = pad.t + innerH - ((p.latency_ms - min) / span) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const line = theme.palette.chart.line;
  const fillStart = theme.palette.chart.fillStartOpacity;
  const fillEnd = theme.palette.chart.fillEndOpacity;

  const areaPath = `${path} L ${pad.l + innerW} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z`;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="rtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={line} stopOpacity={fillStart} />
            <stop offset="100%" stopColor={line} stopOpacity={fillEnd} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#rtFill)" />
        <path
          d={path}
          fill="none"
          stroke={line}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x={pad.l} y={h - 6} fill={axisFill} fontSize={10} fontFamily={fontMono}>
          {new Date(t0).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
        </text>
        <text x={w - pad.r} y={h - 6} textAnchor="end" fill={axisFill} fontSize={10} fontFamily={fontMono}>
          {new Date(t1).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
        </text>
        <text x={pad.l - 6} y={pad.t + 10} textAnchor="end" fill={axisFill} fontSize={10} fontFamily={fontMono}>
          {max}ms
        </text>
        <text x={pad.l - 6} y={pad.t + innerH} textAnchor="end" fill={axisFill} fontSize={10} fontFamily={fontMono}>
          {min}ms
        </text>
      </svg>
    </Box>
  );
}
