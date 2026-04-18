import Box from '@mui/material/Box';

export default function StalePill() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        ml: 0.75,
        px: 0.75,
        py: 0.125,
        borderRadius: 1,
        fontSize: 9,
        lineHeight: 1.2,
        letterSpacing: '0.06em',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: '#EF9F27',
        bgcolor: 'rgba(239, 159, 39, 0.12)',
        border: '1px solid rgba(239, 159, 39, 0.35)',
      }}
    >
      STALE
    </Box>
  );
}
