import { createHash } from 'node:crypto';

export function buildSourceKey(parts: Record<string, string | number | null | undefined>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${String(parts[k] ?? '').trim()}`)
    .join('|');
  return normalized;
}

export function hashSourceKey(sourceKey: string): string {
  return createHash('sha256').update(sourceKey).digest('hex');
}
