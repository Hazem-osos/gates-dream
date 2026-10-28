import express from 'express';
import type { AddressInfo } from 'node:net';
import { asyncSafeRouter } from '../../shared/middleware/async-handler';
import { AppError, errorHandler } from '../../shared/middleware/error-handler';

/**
 * HR routes rely on asyncSafeRouter: index.ts exits the process on any
 * unhandled rejection, so an async handler that throws must reach the
 * global error handler instead.
 */
describe('asyncSafeRouter', () => {
  async function call(path: string, method = 'GET') {
    const app = express();
    const router = asyncSafeRouter();
    router.get('/app-error', async () => {
      throw new AppError(409, 'رصيد الإجازة غير كافٍ');
    });
    router.post('/sync-throw', () => {
      throw new AppError(422, 'بيانات غير صالحة');
    });
    router.get(
      '/middleware-chain',
      async (_req, _res, next) => next(),
      async (_req, res) => {
        res.json({ ok: true });
      }
    );
    app.use('/r', router);
    app.use(errorHandler);

    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/r${path}`, { method });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    } finally {
      server.close();
    }
  }

  it('turns a rejected async handler into the AppError status', async () => {
    const res = await call('/app-error');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('رصيد الإجازة غير كافٍ');
  });

  it('turns a synchronous throw into the AppError status', async () => {
    const res = await call('/sync-throw', 'POST');
    expect(res.status).toBe(422);
  });

  it('keeps middleware chains working', async () => {
    const res = await call('/middleware-chain');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
