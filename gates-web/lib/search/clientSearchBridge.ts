import type { SearchIndexEntity } from '@/workers/search.worker';

type RebuildDoc = { id: string; fields: string[] };

type PendingSearch = {
  resolve: (ids: string[]) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let requestSeq = 0;
const pendingSearches = new Map<number, PendingSearch>();

function ensureWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url));
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { type: string; requestId?: number; ids?: string[] };
      if (data.type === 'searchResult' && data.requestId != null) {
        const pending = pendingSearches.get(data.requestId);
        if (pending) {
          pendingSearches.delete(data.requestId);
          pending.resolve(data.ids ?? []);
        }
      }
    };
    worker.onerror = () => {
      for (const [, p] of pendingSearches) {
        p.reject(new Error('Search worker failed'));
      }
      pendingSearches.clear();
    };
    return worker;
  } catch {
    return null;
  }
}

export function rebuildClientSearchIndex(entity: SearchIndexEntity, docs: RebuildDoc[]): void {
  const w = ensureWorker();
  if (!w) return;
  w.postMessage({ type: 'rebuild', entity, docs });
}

export function clientSearch(entity: SearchIndexEntity, query: string): Promise<string[]> {
  const w = ensureWorker();
  const q = query.trim();
  if (!w || !q) return Promise.resolve([]);

  const requestId = ++requestSeq;
  return new Promise((resolve, reject) => {
    pendingSearches.set(requestId, { resolve, reject });
    w.postMessage({ type: 'search', entity, query: q, requestId });
    window.setTimeout(() => {
      if (pendingSearches.has(requestId)) {
        pendingSearches.delete(requestId);
        resolve([]);
      }
    }, 500);
  });
}

export function isClientSearchAvailable(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}
