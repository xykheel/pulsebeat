import GlobalStyles from '@mui/material/GlobalStyles';
import { colors, brand, tokens } from './tokens';

/**
 * Exposes core brand colours as CSS custom properties for non-MUI surfaces
 * (e.g. raw SVG, static HTML, future plain CSS).
 */
export function BrandRootStyles() {
  const { brand: b, surface, border, status } = colors;
  return (
    <GlobalStyles
      styles={{
        ':root': {
          '--pb-brand-name': `"${brand.displayName}"`,
          '--pb-color-canvas': surface.canvas,
          '--pb-color-elevated': surface.elevated,
          '--pb-color-border': border.default,
          '--pb-color-border-emphasis': border.emphasis,
          '--pb-color-primary': b.primary,
          '--pb-color-primary-channel': b.primaryChannel,
          '--pb-color-online': status.online,
          '--pb-color-offline': status.offline,
          '--pb-font-sans': tokens.typography.sans,
          '--pb-font-mono': tokens.typography.mono,
        },
      }}
    />
  );
}
