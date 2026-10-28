/**
 * Security (availability): GET /api/v1/public/pos/receipts/:token needs no login. An unknown
 * token throws 404; unwrapped on Express 4 that rejection reached `unhandledRejection`, which
 * exits the whole API. The error must go to `next` instead.
 */
const receiptByToken = jest.fn();

jest.mock('../../modules/pos/services/pos-commercial.service', () => ({
  posCommercialService: { receiptByToken: (...a: unknown[]) => receiptByToken(...a) },
}));

import type { Request, Response } from 'express';
import router from '../../modules/pos/routes/pos-public-receipt.routes';
import { AppError } from '../../shared/middleware/error-handler';

type Layer = { route?: { path: string; stack: Array<{ handle: (...a: unknown[]) => unknown }> } };

function handler() {
  const layer = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === '/:token');
  if (!layer?.route) throw new Error('route not found');
  return layer.route.stack[0].handle;
}

async function call(token: string) {
  const json = jest.fn();
  const next = jest.fn();
  const req = { params: { token } } as unknown as Request;
  const res = { json } as unknown as Response;
  handler()(req, res, next);
  await new Promise((r) => setImmediate(r));
  return { json, next };
}

describe('public POS receipt route', () => {
  it('passes an unknown-token 404 to next instead of rejecting', async () => {
    receiptByToken.mockRejectedValueOnce(new AppError(404, 'Receipt not found'));
    const { json, next } = await call('missing');
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('returns the receipt for a valid token', async () => {
    receiptByToken.mockResolvedValueOnce({ id: 'o1' });
    const { json, next } = await call('good');
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ status: 'success', data: { id: 'o1' } });
  });
});
