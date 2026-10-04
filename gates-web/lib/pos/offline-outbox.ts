const DB_NAME = 'gates-pos-offline';
const STORE = 'outbox';

export type OfflinePosJob = {
  clientRequestId: string;
  shiftId: string;
  body: unknown;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'clientRequestId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueuePosSale(job: OfflinePosJob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPosOutbox(): Promise<OfflinePosJob[]> {
  const db = await openDb();
  const rows = await new Promise<OfflinePosJob[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as OfflinePosJob[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

export async function updatePosOutbox(clientRequestId: string, patch: Partial<OfflinePosJob>) {
  const rows = await listPosOutbox();
  const current = rows.find((row) => row.clientRequestId === clientRequestId);
  if (!current) return;
  await enqueuePosSale({ ...current, ...patch, clientRequestId });
}

export async function removePosOutbox(clientRequestId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(clientRequestId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
