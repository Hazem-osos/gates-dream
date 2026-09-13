'use client';

/**
 * Mandatory-field marker (red dot + tooltip). Shared across enterprise-form
 * headers and quick-add modals so every "this field is required" hint uses
 * the exact same visual language (Sales Invoice Enterprise Redesign, Phase 8).
 */
export function RequiredDot({ hint }: { hint: string }) {
  return (
    <span
      title={hint}
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle ms-1"
    />
  );
}
