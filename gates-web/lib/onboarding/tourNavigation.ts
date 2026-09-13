import { startTransition } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { markAbortNoiseGracePeriod } from '@/lib/api/isAbortError';

type TourRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

function afterFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Cancel in-flight API queries, then client-navigate for academy tour steps. */
export async function pushTourRoute(
  router: TourRouter,
  queryClient: QueryClient,
  href: string
): Promise<void> {
  markAbortNoiseGracePeriod(3500);
  try {
    await queryClient.cancelQueries({ type: 'active' });
  } catch {
    /* ignore */
  }
  await afterFrames(2);
  startTransition(() => {
    router.push(href);
  });
}

export async function replaceTourRoute(
  router: TourRouter,
  queryClient: QueryClient,
  href: string
): Promise<void> {
  markAbortNoiseGracePeriod(3500);
  try {
    await queryClient.cancelQueries({ type: 'active' });
  } catch {
    /* ignore */
  }
  await afterFrames(2);
  startTransition(() => {
    router.replace(href);
  });
}
