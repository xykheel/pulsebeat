/**
 * Tailwind `className` strings that mirror brand/nav rules — keep nav + shells consistent.
 */
export function navLinkClassName(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 font-semibold text-[0.9375rem] no-underline transition-colors',
    active ? 'text-pb-primary' : 'text-white/55 hover:text-pb-primary',
  ].join(' ');
}
