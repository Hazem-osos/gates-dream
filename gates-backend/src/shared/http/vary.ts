import type { Response } from 'express';

/** Append a Vary token without duplicating an existing one. */
export function appendVary(res: Response, value: string): void {
  if (res.headersSent) return;
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', value);
    return;
  }
  const parts = String(current)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.some((p) => p.toLowerCase() === value.toLowerCase())) {
    parts.push(value);
    res.setHeader('Vary', parts.join(', '));
  }
}

export const ACCEPT_ENCODING_VARY = 'Accept-Encoding';
