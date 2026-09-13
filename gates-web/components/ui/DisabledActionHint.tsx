'use client';

import type { ReactNode } from 'react';

type Props = {
  hint?: string;
  disabled?: boolean;
  children: ReactNode;
};

/** Hover tooltip around a disabled control (native title does not fire on disabled buttons). */
export function DisabledActionHint({ hint, disabled, children }: Props) {
  if (!hint || !disabled) return <>{children}</>;

  return (
    <span className="relative inline-flex group/hint">
      <span className="inline-flex cursor-not-allowed">{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[90] mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-[#D6EAF3] bg-[#0A3D5E] px-2.5 py-2 text-right text-[11px] font-medium leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover/hint:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}
