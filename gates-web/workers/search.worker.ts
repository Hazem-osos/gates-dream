/// <reference lib="webworker" />

import MiniSearch from 'minisearch';
import { normalizeArabicForSearch, normalizeSearchBlob } from '../lib/search/arabicNormalize';

export type SearchIndexEntity = 'items' | 'customers' | 'suppliers';

type IndexDoc = {
  id: string;
  blob: string;
};

type WorkerIn =
  | { type: 'rebuild'; entity: SearchIndexEntity; docs: { id: string; fields: string[] }[] }
  | { type: 'search'; entity: SearchIndexEntity; query: string; requestId: number }
  | { type: 'ping' };

type WorkerOut =
  | { type: 'ready'; entity: SearchIndexEntity; count: number }
  | { type: 'searchResult'; entity: SearchIndexEntity; requestId: number; ids: string[] }
  | { type: 'pong' };

const indexes = new Map<SearchIndexEntity, MiniSearch<IndexDoc>>();

function getIndex(entity: SearchIndexEntity): MiniSearch<IndexDoc> {
  let idx = indexes.get(entity);
  if (!idx) {
    idx = new MiniSearch<IndexDoc>({
      fields: ['blob'],
      storeFields: ['id'],
      idField: 'id',
      processTerm: (term) => normalizeArabicForSearch(term).split(/\s+/).filter(Boolean),
      searchOptions: {
        prefix: true,
        fuzzy: 0.15,
        boost: { blob: 1 },
      },
    });
    indexes.set(entity, idx);
  }
  return idx;
}

function rebuild(entity: SearchIndexEntity, docs: { id: string; fields: string[] }[]) {
  const idx = getIndex(entity);
  idx.removeAll();
  const prepared: IndexDoc[] = docs.map((d) => ({
    id: d.id,
    blob: normalizeSearchBlob(d.fields),
  }));
  if (prepared.length) idx.addAll(prepared);
  const out: WorkerOut = { type: 'ready', entity, count: prepared.length };
  self.postMessage(out);
}

function search(entity: SearchIndexEntity, query: string, requestId: number) {
  const q = normalizeArabicForSearch(query);
  if (!q) {
    const out: WorkerOut = { type: 'searchResult', entity, requestId, ids: [] };
    self.postMessage(out);
    return;
  }
  const idx = getIndex(entity);
  const hits = idx.search(q, { prefix: true, fuzzy: 0.15 });
  const out: WorkerOut = {
    type: 'searchResult',
    entity,
    requestId,
    ids: hits.map((h) => h.id),
  };
  self.postMessage(out);
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type === 'ping') {
    const out: WorkerOut = { type: 'pong' };
    self.postMessage(out);
    return;
  }
  if (msg.type === 'rebuild') {
    rebuild(msg.entity, msg.docs);
    return;
  }
  if (msg.type === 'search') {
    search(msg.entity, msg.query, msg.requestId);
  }
};
