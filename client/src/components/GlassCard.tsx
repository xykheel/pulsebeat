import { Paper, type PaperProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { glassCardSx } from '../theme';

export default function GlassCard({ children, sx, ...props }: PaperProps) {
  const theme = useTheme();
  const base = glassCardSx(theme);
  const merged: SxProps<Theme> = sx == null ? base : Array.isArray(sx) ? [base, ...sx] : [base, sx];
  return (
    <Paper elevation={0} sx={merged} {...props}>
      {children}
    </Paper>
  );
}
