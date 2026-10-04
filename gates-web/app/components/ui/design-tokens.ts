/** Gates ERP UI tokens — semantic CSS variables, light + dark. */
export const gatesColors = {
  accent: 'var(--primary)',
  accentDark: 'var(--primary-hover)',
  accentMuted: 'var(--info-soft)',
  surface: 'var(--surface-2)',
  border: 'var(--border-subtle)',
  inputBorder: 'var(--border-subtle)',
} as const;

export const gatesRadius = {
  control: 'rounded-lg',
  card: 'rounded-xl',
  shell: 'rounded-2xl',
} as const;

export const gatesFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
