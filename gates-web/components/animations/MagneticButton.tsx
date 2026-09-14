'use client';

import Link from 'next/link';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { gsap, registerGsapPlugins } from '../../lib/gsap';

type MagneticButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'solid' | 'ghost' | 'inverse' | 'brand' | 'brand-ghost';
  className?: string;
};

function isFinePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function MagneticButton({ href, children, variant = 'solid', className = '' }: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isFinePointer() || !ref.current) return;
    registerGsapPlugins();
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    gsap.to(ref.current, { x: x * 0.22, y: y * 0.22, duration: 0.35, ease: 'power3.out' });
  };

  const onLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' });
  };

  const styles =
    variant === 'solid'
      ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-80'
      : variant === 'inverse'
        ? 'bg-[var(--text-inverse)] text-[var(--surface-ink)] hover:opacity-80'
        :         variant === 'brand'
          ? 'bg-[var(--gates-blue)] text-[var(--gates-white)] hover:scale-[1.03] hover:bg-[var(--gates-blue-strong)]'
          : variant === 'brand-ghost'
            ? 'border border-[var(--gates-blue)] bg-white text-[var(--gates-navy)] hover:scale-[1.03] hover:border-[var(--gates-blue-strong)] hover:bg-[var(--gates-blue-soft)]'
            : 'border border-current bg-transparent hover:bg-[var(--foreground)] hover:text-[var(--background)]';

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`inline-flex items-center gap-3 rounded-full px-6 py-3 text-[0.8rem] font-medium transition duration-300 ${styles} ${className}`}
    >
      {children}
      <span aria-hidden className="gates-arrow inline-block transition-transform duration-300">
        →
      </span>
    </Link>
  );
}
