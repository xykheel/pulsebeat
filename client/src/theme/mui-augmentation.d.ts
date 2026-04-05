import type { CSSProperties } from 'react';

declare module '@mui/material/styles' {
  interface TypeText {
    /** Axis labels, chart footnotes — between secondary and disabled. */
    muted: string;
  }
  interface Palette {
    brand: {
      primaryChannel: string;
    };
    status: {
      online: string;
      offline: string;
      onlineContainer: string;
      offlineContainer: string;
      onlineBorder: string;
      offlineBorder: string;
      inactive: string;
      inactiveContainer: string;
    };
    chart: {
      line: string;
      fillStartOpacity: number;
      fillEndOpacity: number;
    };
    shell: {
      appBar: string;
      appBarBorder: string;
    };
  }
  interface PaletteOptions {
    brand?: Partial<Palette['brand']>;
    status?: Partial<Palette['status']>;
    chart?: Partial<Palette['chart']>;
    shell?: Partial<Palette['shell']>;
  }
  interface TypographyVariants {
    data: CSSProperties;
    dataSmall: CSSProperties;
    captionMono: CSSProperties;
  }
  interface TypographyVariantsOptions {
    data?: CSSProperties;
    dataSmall?: CSSProperties;
    captionMono?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    data: true;
    dataSmall: true;
    captionMono: true;
  }
}
