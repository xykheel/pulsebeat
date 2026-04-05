import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { radii, colors, blur, motion } from './tokens';

export function loginPaperSx(theme: Theme): SxProps<Theme> {
  return {
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    backdropFilter: blur.glass,
    WebkitBackdropFilter: blur.glass,
    borderRadius: `${radii.panel}px`,
  };
}

export function glassCardSx(theme: Theme): SxProps<Theme> {
  const ch = theme.palette.brand.primaryChannel;
  return {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: `${radii.card}px`,
    transition: `box-shadow ${motion.durationCard} ${motion.easingStandard}, border-color ${motion.durationCard} ${motion.easingStandard}`,
    '&:hover': {
      boxShadow: `0 0 24px rgba(${ch}, 0.08)`,
      borderColor: colors.border.emphasis,
    },
  };
}

export function listRowDividerSx(): SxProps<Theme> {
  return {
    borderBottom: `1px solid ${colors.border.default}`,
  };
}
