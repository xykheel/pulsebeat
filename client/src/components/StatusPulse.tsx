import { Box } from '@mui/material';
import { keyframes, useTheme } from '@mui/material/styles';

const pulseGreen = keyframes`
  0% { transform: scale(0.95); opacity: 0.9; }
  70% { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
`;

const flashRed = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

export default function StatusPulse({ up }: { up: boolean }) {
  const theme = useTheme();
  const colour = up ? theme.palette.status.online : theme.palette.status.offline;
  return (
    <Box
      sx={{
        position: 'relative',
        width: 14,
        height: 14,
        flexShrink: 0,
      }}
      aria-hidden
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: colour,
          animation: up ? 'none' : `${flashRed} 1.2s ease-in-out infinite`,
        }}
      />
      {up && (
        <>
          <Box
            sx={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${colour}`,
              opacity: 0.5,
              animation: `${pulseGreen} 2s ease-out infinite`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${colour}`,
              opacity: 0.35,
              animation: `${pulseGreen} 2s ease-out infinite`,
              animationDelay: '0.6s',
            }}
          />
        </>
      )}
    </Box>
  );
}
