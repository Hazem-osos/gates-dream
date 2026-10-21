'use client';

import { useEffect, useRef, useState } from 'react';
import type { MigrationProgressSnapshot } from './migration-types';
import { apiClient } from '@/lib/api/client';

/**
 * SSE progress with polling fallback — survives refresh when job id is known.
 */
export function useMigrationProgressStream(jobId: string | null, enabled: boolean) {
  const [progress, setProgress] = useState<MigrationProgressSnapshot | null>(null);
  const [transport, setTransport] = useState<'sse' | 'poll' | 'idle'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) {
      setTransport('idle');
      return () => undefined;
    }

    let closed = false;
    const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
    const base =
      fromEnv || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1');
    const url = `${base}/migration-engine/jobs/${jobId}/events`;

    const startPoll = () => {
      if (pollRef.current) return;
      setTransport('poll');
      const tick = async () => {
        try {
          const res = await apiClient.get<MigrationProgressSnapshot>(
            `/migration-engine/jobs/${jobId}/progress`
          );
          if (!closed && res.data) setProgress(res.data);
        } catch {
          /* ignore transient */
        }
      };
      void tick();
      pollRef.current = setInterval(() => void tick(), 4000);
    };

    const es = typeof EventSource !== 'undefined' ? new EventSource(url, { withCredentials: true }) : null;
    if (!es) {
      startPoll();
      return () => {
        closed = true;
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }

    setTransport('sse');
    es.addEventListener('progress', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as MigrationProgressSnapshot;
        setProgress(data);
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => {
      es.close();
      startPoll();
    };

    return () => {
      closed = true;
      es.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, enabled]);

  return { progress, transport };
}
