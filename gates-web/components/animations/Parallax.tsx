'use client';

import type { ReactNode } from 'react';

type ParallaxProps = {
  children: ReactNode;
  className?: string;
};

/** Depth layer. GSAP sets transform from the parent scene — no per-frame React state. */
export function Parallax({ children, className = '' }: ParallaxProps) {
  return (
    <div data-parallax className={className}>
      {children}
    </div>
  );
}
