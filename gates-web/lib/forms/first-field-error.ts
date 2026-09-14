import type { FieldErrors } from 'react-hook-form';

export function firstFieldError(errors: FieldErrors, fallback = 'أكمل الحقول المطلوبة قبل الحفظ'): string {
  const walk = (node: unknown): string | undefined => {
    if (!node || typeof node !== 'object') return undefined;
    if ('message' in node && (node as { message?: unknown }).message) {
      return String((node as { message: unknown }).message);
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return undefined;
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = walk(value);
      if (found) return found;
    }
    return undefined;
  };
  return walk(errors) || fallback;
}
