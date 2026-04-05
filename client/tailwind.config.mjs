/** @type {import('tailwindcss').Config} */
export default {
  /** Raise specificity so utilities can override MUI where needed (see MUI + Tailwind guide). */
  important: '#root',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  /** MUI `CssBaseline` owns resets; Tailwind Preflight would fight component styles. */
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        /** Mirrors `BrandRootStyles` / `tokens.ts` — use for layout & marketing surfaces. */
        pb: {
          canvas: 'var(--pb-color-canvas)',
          elevated: 'var(--pb-color-elevated)',
          border: 'var(--pb-color-border)',
          'border-emphasis': 'var(--pb-color-border-emphasis)',
          primary: 'var(--pb-color-primary)',
          online: 'var(--pb-color-online)',
          offline: 'var(--pb-color-offline)',
        },
      },
      fontFamily: {
        sans: ['var(--pb-font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--pb-font-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        shell: '1536px',
      },
    },
  },
  plugins: [],
};
