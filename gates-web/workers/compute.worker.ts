/// <reference lib="webworker" />

import { parseSheetMatrix } from '../lib/import/excelRowMapper';
import { tafqeetEgp } from '../lib/print/tafqeet';

type ComputeIn =
  | { type: 'parseExcelMatrix'; requestId: number; rows: unknown[][] }
  | { type: 'tafqeetBulk'; requestId: number; amounts: number[] };

type ComputeOut =
  | { type: 'parseExcelMatrixResult'; requestId: number; mapped: Record<string, string | number | null>[] }
  | { type: 'tafqeetBulkResult'; requestId: number; lines: string[] };

self.onmessage = (ev: MessageEvent<ComputeIn>) => {
  const msg = ev.data;
  if (msg.type === 'parseExcelMatrix') {
    const mapped = parseSheetMatrix(msg.rows);
    const out: ComputeOut = { type: 'parseExcelMatrixResult', requestId: msg.requestId, mapped };
    self.postMessage(out);
    return;
  }
  if (msg.type === 'tafqeetBulk') {
    const lines = msg.amounts.map((a) => tafqeetEgp(a));
    const out: ComputeOut = { type: 'tafqeetBulkResult', requestId: msg.requestId, lines };
    self.postMessage(out);
  }
};
