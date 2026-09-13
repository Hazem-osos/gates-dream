'use client';

import type { ReactNode } from 'react';

type RevealTextProps = {
  children: ReactNode;
  className?: string;
};

/** Clip wrapper for GSAP-driven reveals. The parent timeline animates [data-reveal]. */
export function RevealText({ children, className = '' }: RevealTextProps) {
  return (
    <span className={`inline-block overflow-hidden ${className}`}>
      <span data-reveal className="inline-block will-change-transform">
        {children}
      </span>
    </span>
  );
}
