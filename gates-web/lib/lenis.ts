'use client';

import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion, registerGsapPlugins } from './gsap';

let marketingLenis: Lenis | null = null;

export function getMarketingLenis(): Lenis | null {
  return marketingLenis;
}

export function scrollToHash(hash: string) {
  const id = hash.replace('#', '');
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;

  const reduced = prefersReducedMotion();
  if (marketingLenis && !reduced) {
    marketingLenis.scrollTo(target, { offset: 0, duration: 1.15 });
    return;
  }
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

export function setMarketingLenisStopped(stopped: boolean) {
  if (!marketingLenis) return;
  if (stopped) marketingLenis.stop();
  else marketingLenis.start();
}

/** Plays the homepage cinematic by scrolling it once. Stops if the user takes over. */
export function startHomepageAutoplay(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (prefersReducedMotion()) return () => undefined;
  if (window.location.hash) return () => undefined;

  let cancelled = false;
  let started = false;
  let timer = 0;

  const stopProgrammaticScroll = () => {
    const lenis = getMarketingLenis();
    if (lenis) {
      lenis.scrollTo(window.scrollY, { immediate: true });
    }
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    window.clearTimeout(timer);
    if (started) stopProgrammaticScroll();
  };

  const onUserInterrupt = () => cancel();

  window.addEventListener('wheel', onUserInterrupt, { passive: true });
  window.addEventListener('touchstart', onUserInterrupt, { passive: true });
  window.addEventListener('keydown', onUserInterrupt);

  timer = window.setTimeout(() => {
    if (cancelled) return;
    const root = document.querySelector('.gates-marketing');
    const sections = root ? Array.from(root.querySelectorAll<HTMLElement>('section')) : [];
    const last = sections[sections.length - 1];
    if (!last) return;

    const endY = Math.max(0, last.offsetTop + last.offsetHeight - window.innerHeight);
    if (endY < 80) return;

    const duration = Math.min(34, Math.max(10, (endY / window.innerHeight) * 3.1));
    const lenis = getMarketingLenis();
    started = true;
    if (lenis) {
      lenis.scrollTo(endY, { duration, easing: (t) => t });
    } else {
      window.scrollTo({ top: endY, behavior: 'smooth' });
    }
  }, 720);

  return () => {
    cancel();
    window.removeEventListener('wheel', onUserInterrupt);
    window.removeEventListener('touchstart', onUserInterrupt);
    window.removeEventListener('keydown', onUserInterrupt);
  };
}

/**
 * Single RAF: Lenis is driven by GSAP's ticker (autoRaf: false).
 * ScrollTrigger.update runs on Lenis scroll so scrub timelines stay in sync.
 */
export function createMarketingLenis(): (() => void) | null {
  if (typeof window === 'undefined') return null;
  registerGsapPlugins();

  if (prefersReducedMotion()) {
    const later = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    return () => window.clearTimeout(later);
  }

  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.085,
    smoothWheel: true,
    syncTouch: false,
  });
  marketingLenis = lenis;

  const onLenisScroll = () => {
    ScrollTrigger.update();
  };
  lenis.on('scroll', onLenisScroll);

  const tickerFn = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);

  let resizeTimer = 0;
  const refresh = () => ScrollTrigger.refresh();
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, 120);
  };
  requestAnimationFrame(refresh);
  window.addEventListener('resize', onResize);

  if (window.location.hash) {
    window.setTimeout(() => scrollToHash(window.location.hash), 360);
  }

  return () => {
    window.removeEventListener('resize', onResize);
    window.clearTimeout(resizeTimer);
    lenis.off('scroll', onLenisScroll);
    gsap.ticker.remove(tickerFn);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
    if (marketingLenis === lenis) marketingLenis = null;
  };
}
