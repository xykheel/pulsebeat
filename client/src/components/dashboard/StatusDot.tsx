import Box from '@mui/material/Box';

export type StatusDotState = 'up' | 'degraded' | 'down' | 'paused';

const DOT: Record<StatusDotState, { fill: string; halo: string }> = {
  up: { fill: '#5DCAA5', halo: 'rgba(93, 202, 165, 0.2)' },
  degraded: { fill: '#EF9F27', halo: 'rgba(239, 159, 39, 0.2)' },
  down: { fill: '#E24B4A', halo: 'rgba(226, 75, 74, 0.2)' },
  paused: { fill: 'rgba(255,255,255,0.35)', halo: 'rgba(255, 255, 255, 0.12)' },
};

export default function StatusDot({ status, 'aria-label': ariaLabel }: { status: StatusDotState; 'aria-label'?: string }) {
  const { fill, halo } = DOT[status];
  return (
    <Box
      component="span"
      aria-label={ariaLabel ?? `Monitor status: ${status}`}
      sx={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: fill,
        boxShadow: `0 0 0 3px ${halo}`,
      }}
    />
  );
}
