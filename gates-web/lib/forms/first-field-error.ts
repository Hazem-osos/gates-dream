import type { FieldErrors } from 'react-hook-form';

function isDomNode(value: object): boolean {
  return typeof (value as { nodeType?: unknown }).nodeType === 'number';
}

/** First user-facing message from RHF/Zod errors. Never walks DOM refs. */
export function firstFieldError(
  errors: FieldErrors,
  fallback = 'أكمل الحقول المطلوبة قبل الحفظ'
): string {
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number): string | undefined => {
    if (node == null || depth > 12) return undefined;
    if (typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    if (isDomNode(node)) return undefined;
    seen.add(node);

    const rec = node as Record<string, unknown>;
    if (typeof rec.message === 'string' && rec.message.trim()) {
      return rec.message;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    for (const [key, value] of Object.entries(rec)) {
      if (key === 'ref' || key === 'types') continue;
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return undefined;
  };

  return walk(errors, 0) || fallback;
}
