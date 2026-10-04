import { STOCK_GL_SKIPPED_AR } from './stock-gl-posting-guard';

export type StockPostServiceResult = { success?: boolean; glSkipped?: boolean };

export function stockPostJson(
  result: StockPostServiceResult,
  successMessage: string
): { status: 'success'; message: string; data: StockPostServiceResult } {
  return {
    status: 'success',
    message: result.glSkipped ? STOCK_GL_SKIPPED_AR : successMessage,
    data: result,
  };
}
