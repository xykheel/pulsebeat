import Box from '@mui/material/Box';

const PRESETS: Record<string, { bg: string; color: string }> = {
  monitoring: { bg: 'rgba(133, 183, 235, 0.1)', color: '#B5D4F4' },
  ai: { bg: 'rgba(127, 119, 221, 0.12)', color: '#AFA9EC' },
  security: { bg: 'rgba(226, 75, 74, 0.12)', color: '#E24B4A' },
};

export default function MonitorTagBadge({ name }: { name: string }) {
  const key = name.trim().toLowerCase();
  const preset = PRESETS[key];
  const bg = preset?.bg ?? 'rgba(255,255,255,0.06)';
  const color = preset?.color ?? 'rgba(255,255,255,0.6)';

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: '10px',
        fontSize: 10,
        letterSpacing: '0.04em',
        fontWeight: 600,
        textTransform: 'uppercase',
        bgcolor: bg,
        color,
        lineHeight: 1.2,
      }}
    >
      {name}
    </Box>
  );
}
