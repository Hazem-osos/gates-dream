/** Gates ERP UI tokens — use with Tailwind arbitrary values or shared class maps. */
export const gatesColors = {
  accent: '#0E78AA',
  accentDark: '#094C6B',
  accentMuted: '#DEEFF6',
  surface: '#F6FBFD',
  border: '#E6F0F7',
  inputBorder: '#D6EAF3',
} as const;

export const gatesRadius = {
  control: 'rounded-lg',
  card: 'rounded-xl',
  shell: 'rounded-2xl',
} as const;

export const gatesFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E78AA]/40 focus-visible:ring-offset-2';
