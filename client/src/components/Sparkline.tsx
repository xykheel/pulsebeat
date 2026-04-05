import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function Sparkline({
  values,
  height = 40,
  width = 120,
  colour,
}: {
  values: (number | null)[];
  height?: number;
  width?: number;
  /** Defaults to theme chart accent (brand primary). */
  colour?: string;
}) {
  const theme = useTheme();
  const strokeColour = colour ?? theme.palette.chart.line;
  const w = width;
  const h = height;
  const nums = values.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null));
  const defined = nums.filter((v): v is number => v != null);
  if (!defined.length) {
    return (
      <Box sx={{ height: h, width: w, opacity: 0.25 }} display="flex" alignItems="center">
        <svg width={w} height={h} aria-hidden />
      </Box>
    );
  }
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const pad = 4;
  const span = max - min || 1;
  const pts = nums.map((v, i) => {
    if (v == null) return null;
    const x = pad + (i / Math.max(1, nums.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const segments: string[] = [];
  let current: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i]) current.push(pts[i]!);
    else if (current.length) {
      segments.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) segments.push(current.join(' '));

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden>
      {segments.map((d) => (
        <polyline
          key={d}
          fill="none"
          stroke={strokeColour}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          points={d}
        />
      ))}
    </svg>
  );
}
