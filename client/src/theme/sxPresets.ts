import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { radii, colors, blur, motion } from './tokens';

export function appBarSx(theme: Theme): SxProps<Theme> {
  return {
    background: theme.palette.shell.appBar,
    backdropFilter: blur.glass,
    WebkitBackdropFilter: blur.glass,
    borderBottom: `1px solid ${theme.palette.shell.appBarBorder}`,
  };
}

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

export function horizontalScrollThinSx(): SxProps<Theme> {
  return {
    overflowX: 'auto',
    maxWidth: '100%',
    pb: 0.5,
    WebkitOverflowScrolling: 'touch',
    '&::-webkit-scrollbar': { height: 4 },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: colors.scrollbars.thumb,
      borderRadius: radii.hairline,
    },
  };
}

export function listRowDividerSx(): SxProps<Theme> {
  return {
    borderBottom: `1px solid ${colors.border.default}`,
  };
}

export function monitorStateChipSx(
  theme: Theme,
  state: 'online' | 'offline' | 'paused'
): SxProps<Theme> {
  const mono = {
    fontFamily: theme.typography.captionMono.fontFamily,
    fontSize: '0.7rem',
    height: 22,
  };
  if (state === 'paused') {
    return {
      ...mono,
      backgroundColor: theme.palette.status.inactiveContainer,
      color: 'text.secondary',
      border: '1px solid transparent',
    };
  }
  if (state === 'online') {
    return {
      ...mono,
      backgroundColor: theme.palette.status.onlineContainer,
      color: theme.palette.status.online,
      border: '1px solid',
      borderColor: theme.palette.status.onlineBorder,
    };
  }
  return {
    ...mono,
    backgroundColor: theme.palette.status.offlineContainer,
    color: theme.palette.status.offline,
    border: '1px solid',
    borderColor: theme.palette.status.offlineBorder,
  };
}
