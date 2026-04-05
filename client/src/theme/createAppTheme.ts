import { createTheme } from '@mui/material/styles';
import { canvasBackgroundImage, colors, radii, tokens, blur } from './tokens';

const { brand: brandColors, status, surface, border, text, shell } = colors;

export function createAppTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: brandColors.primary,
        light: brandColors.primaryLight,
        dark: brandColors.primaryDark,
      },
      success: { main: status.online },
      error: { main: status.offline },
      background: {
        default: surface.canvas,
        paper: surface.elevated,
      },
      text: {
        primary: text.primary,
        secondary: text.secondary,
        muted: text.muted,
      },
      divider: border.default,
      brand: {
        primaryChannel: brandColors.primaryChannel,
      },
      status: {
        online: status.online,
        offline: status.offline,
        onlineContainer: status.onlineContainer,
        offlineContainer: status.offlineContainer,
        onlineBorder: status.onlineBorder,
        offlineBorder: status.offlineBorder,
        inactive: surface.inactiveDot,
        inactiveContainer: surface.subtle,
      },
      chart: {
        line: brandColors.primary,
        fillStartOpacity: 0.25,
        fillEndOpacity: 0,
      },
      shell: {
        appBar: shell.appBarBackdrop,
        appBarBorder: border.default,
      },
    },
    typography: {
      fontFamily: tokens.typography.sans,
      h4: { fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      body2: { fontSize: '0.8125rem' },
      data: {
        fontFamily: tokens.typography.mono,
        fontSize: '0.9rem',
        lineHeight: 1.5,
      },
      dataSmall: {
        fontFamily: tokens.typography.mono,
        fontSize: '0.75rem',
        lineHeight: 1.45,
      },
      captionMono: {
        fontFamily: tokens.typography.mono,
        fontSize: '0.8rem',
        lineHeight: 1.4,
      },
    },
    shape: { borderRadius: radii.panel },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: surface.canvas,
            backgroundImage: canvasBackgroundImage(),
            minHeight: '100vh',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: blur.glass,
            WebkitBackdropFilter: blur.glass,
            border: `1px solid ${border.default}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            background: surface.elevated,
            backdropFilter: blur.glassStrong,
            WebkitBackdropFilter: blur.glassStrong,
            border: `1px solid ${border.default}`,
            borderRadius: `${radii.panel}px`,
          },
        },
      },
      MuiTypography: {
        defaultProps: {
          variantMapping: {
            data: 'span',
            dataSmall: 'span',
            captionMono: 'span',
          },
        },
      },
    },
  });
}
