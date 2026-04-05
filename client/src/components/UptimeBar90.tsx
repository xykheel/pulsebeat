import { Box, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { colors } from '../theme';
import type { DailyBar } from '../types';

export default function UptimeBar90({ bars }: { bars: DailyBar[] | undefined }) {
  const theme = useTheme();
  if (!bars?.length) return null;
  return (
    <Box display="flex" alignItems="flex-end" gap="2px" height={32} sx={{ opacity: 0.95 }}>
      {bars.map((b) => {
        const h = b.pct == null ? 4 : Math.max(6, (b.pct / 100) * 28);
        const bg =
          b.pct == null
            ? colors.surface.subtle
            : b.pct >= 99
              ? theme.palette.status.online
              : b.pct >= 95
                ? `rgba(${colors.status.onlineChannel}, 0.45)`
                : b.pct >= 80
                  ? colors.status.warning
                  : theme.palette.status.offline;
        return (
          <Tooltip
            key={b.day}
            title={b.pct == null ? 'No data' : `${b.pct.toFixed(1)}%`}
            placement="top"
          >
            <Box
              sx={{
                width: 3,
                height: h,
                borderRadius: 0.5,
                backgroundColor: bg,
                transition: 'height 0.2s ease',
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
