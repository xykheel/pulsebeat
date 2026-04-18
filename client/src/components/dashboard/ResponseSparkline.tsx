import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

export type SparklineStatus = 'up' | 'down';

export interface ResponseSparklineProps {
  /** Last N checks (typically ≤18); padded to 18 with leading nulls when shorter. */
  latencies: (number | null)[];
  statuses: SparklineStatus[];
  slowThreshold: number;
  tooltips: string[];
}

const GREEN = '#5DCAA5';
const AMBER = '#EF9F27';
const RED = '#E24B4A';
const EMPTY = 'rgba(255,255,255,0.12)';

const WINDOW = 18;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function padStart<T>(arr: T[], len: number, fill: T): T[] {
  const copy = arr.slice(-len);
  while (copy.length < len) copy.unshift(fill);
  return copy;
}

export default function ResponseSparkline({ latencies, statuses, slowThreshold, tooltips }: ResponseSparklineProps) {
  const rawLat = latencies.slice(-WINDOW);
  const rawSt = statuses.slice(-WINDOW);
  const rawTips = tooltips.slice(-WINDOW);
  const padCount = Math.max(0, WINDOW - rawLat.length);

  const lat = padStart(rawLat, WINDOW, null);
  const st = padStart(rawSt, WINDOW, 'up');
  const tips = padStart(rawTips, WINDOW, '');

  const nums = lat.filter((v): v is number => v != null && Number.isFinite(v));
  const minV = nums.length ? Math.min(...nums) : 0;
  const maxV = nums.length ? Math.max(...nums) : 1;
  const span = maxV === minV ? 1 : maxV - minV;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        height: 36,
        width: 'fit-content',
      }}
      role="img"
      aria-label="Response time trend"
    >
      {lat.map((v, i) => {
        const status = st[i] ?? 'up';
        const isDown = status === 'down';
        const isEmpty = i < padCount;
        const latencyNum = v;

        let heightPct: number;
        if (latencyNum == null || !Number.isFinite(latencyNum)) {
          heightPct = 5;
        } else {
          heightPct = clamp(5, ((latencyNum - minV) / span) * 100, 95);
        }

        let bg: string;
        if (isEmpty) bg = EMPTY;
        else if (isDown) bg = RED;
        else if (latencyNum != null && latencyNum > slowThreshold) bg = AMBER;
        else bg = GREEN;

        const title = tips[i] || '—';

        return (
          <Tooltip key={i} title={title} arrow enterDelay={200}>
            <Box
              component="div"
              tabIndex={0}
              aria-label={title}
              sx={{
                bgcolor: bg,
                borderRadius: 0.5,
                flexShrink: 0,
                alignSelf: 'flex-end',
              }}
              style={{
                width: 5,
                minHeight: 2,
                height: `${heightPct}%`,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
