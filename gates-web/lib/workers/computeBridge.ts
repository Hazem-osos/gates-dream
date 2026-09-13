type Pending = { resolve: (value: unknown) => void };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../../workers/compute.worker.ts', import.meta.url));
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as {
        type?: string;
        requestId?: number;
        mapped?: Record<string, string | number | null>[];
        lines?: string[];
      };
      if (data.requestId == null) return;
      const p = pending.get(data.requestId);
      if (!p) return;
      pending.delete(data.requestId);
      if (data.type === 'parseExcelMatrixResult') {
        p.resolve(data.mapped ?? []);
      } else if (data.type === 'tafqeetBulkResult') {
        p.resolve(data.lines ?? []);
      }
    };
    return worker;
  } catch {
    return null;
  }
}

function run<T>(payload: Record<string, unknown>): Promise<T> {
  const w = ensureWorker();
  if (!w) return Promise.reject(new Error('Compute worker unavailable'));
  const requestId = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as (v: unknown) => void });
    w.postMessage({ ...payload, requestId });
    window.setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        reject(new Error('Compute worker timeout'));
      }
    }, 30_000);
  });
}

export function parseExcelMatrixInWorker(
  rows: unknown[][]
): Promise<Record<string, string | number | null>[]> {
  return run({ type: 'parseExcelMatrix', rows });
}

export function tafqeetBulkInWorker(amounts: number[]): Promise<string[]> {
  return run({ type: 'tafqeetBulk', amounts });
}
