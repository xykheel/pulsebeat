/**
 * Pulsebeat design tokens — single source of truth for brand, colour, motion, and type.
 * Adjust these values to rebrand; the MUI theme and CSS variables are derived from here.
 */
export const brand = {
  /** Shown in the shell, login, and document title (see index.html separately). */
  displayName: 'Pulsebeat',
  /** Subcopy on auth and empty states. */
  tagline: 'Self-hosted uptime monitoring',
} as const;

const fontStacks = {
  sans: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const colors = {
  brand: {
    /** Primary brand / accent (muted cyan–teal). */
    primary: '#6BA8B8',
    primaryLight: '#8BC4D1',
    primaryDark: '#4F8A9A',
    /** "r, g, b" for rgba() in shadows, mesh gradients, and glows */
    primaryChannel: '107, 168, 184',
  },
  status: {
    /** Muted sage — lower luminance for OLED and long sessions (chips, charts, pulses). */
    online: '#5E9B81',
    /** Soft coral / dusty rose — less harsh than pure red. */
    offline: '#E8958F',
    onlineChannel: '94, 155, 129',
    offlineChannel: '232, 149, 143',
    warning: 'rgba(255, 200, 120, 0.45)',
    onlineContainer: 'rgba(94, 155, 129, 0.14)',
    offlineContainer: 'rgba(232, 149, 143, 0.14)',
    onlineBorder: 'rgba(94, 155, 129, 0.32)',
    offlineBorder: 'rgba(232, 149, 143, 0.32)',
  },
  surface: {
    canvas: '#0a0a0f',
    elevated: 'rgba(17, 17, 24, 0.8)',
    subtle: 'rgba(255, 255, 255, 0.08)',
    inactiveDot: 'rgba(255, 255, 255, 0.2)',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.06)',
    emphasis: 'rgba(255, 255, 255, 0.1)',
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.55)',
    muted: 'rgba(255,255,255,0.45)',
  },
  shell: {
    appBarBackdrop: 'rgba(10, 10, 15, 0.75)',
  },
  scrollbars: {
    thumb: 'rgba(255,255,255,0.15)',
  },
} as const;

export const radii = {
  /** Glass cards, list rows */
  card: 6,
  /** Dialogs, login panel */
  panel: 8,
  /** Small UI (scrollbar, uptime bars) */
  hairline: 2,
} as const;

export const blur = {
  glass: 'blur(12px)',
  glassStrong: 'blur(16px)',
} as const;

export const motion = {
  easingStandard: 'ease',
  durationCard: '0.25s',
} as const;

export function canvasBackgroundImage(): string {
  const { primaryChannel } = colors.brand;
  const { onlineChannel } = colors.status;
  return `
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(${primaryChannel}, 0.1), transparent),
    radial-gradient(ellipse 60% 40% at 100% 50%, rgba(${onlineChannel}, 0.035), transparent)
  `;
}

export const tokens = {
  brand,
  colors,
  radii,
  blur,
  motion,
  typography: fontStacks,
} as const;
