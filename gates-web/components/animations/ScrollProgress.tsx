'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, registerGsapPlugins } from '../../lib/gsap';

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerGsapPlugins();
    const el = barRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const rtl = document.documentElement.dir === 'rtl';
      gsap.set(el, { scaleX: 0, transformOrigin: rtl ? '100% 50%' : '0% 50%' });
      gsap.to(el, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      });
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll()
        .filter((t) => t.trigger === document.documentElement)
        .forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-px bg-[var(--foreground)]/10"
      aria-hidden
    >
      <div ref={barRef} className="h-full origin-left bg-[var(--foreground)]" />
    </div>
  );
}
