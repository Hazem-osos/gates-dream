'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { DynamicModalSkeleton } from './DynamicChunkSkeleton';

export function lazyDefaultModal<P>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  label: string
) {
  return dynamic(loader, {
    ssr: false,
    loading: () => <DynamicModalSkeleton label={label} />,
  });
}

export function lazyNamedModal<M, K extends keyof M>(
  loader: () => Promise<M>,
  name: K,
  label: string
) {
  return dynamic(
    () =>
      loader().then((mod) => ({
        default: mod[name] as ComponentType<Record<string, unknown>>,
      })),
    { ssr: false, loading: () => <DynamicModalSkeleton label={label} /> }
  );
}
