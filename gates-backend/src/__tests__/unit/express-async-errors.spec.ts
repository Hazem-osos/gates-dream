/**
 * Security (availability): on Express 4 a rejected async handler reached
 * `unhandledRejection`, and `index.ts` exits the process on that. One bad request could
 * stop the API for every company. The patch must turn it into a normal error response.
 */
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express, { type NextFunction, type Request, type Response } from 'express';
import '../../shared/http/express-async-errors';
import { asyncHandler, asyncSafeRouter } from '../../shared/middleware/async-handler';
import { AppError } from '../../shared/middleware/error-handler';

const unhandled = jest.fn();
let server: Server;
let base: string;
let errorHandlerCalls = 0;

beforeAll(async () => {
  process.on('unhandledRejection', unhandled);
  const app = express();
  app.get('/throws', async () => {
    throw new AppError(404, 'not here');
  });
  app.get('/rejects-undefined', async () => Promise.reject(undefined));
  app.get('/ok', async (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/after-send', async (_req, res) => {
    res.json({ sent: true });
    throw new Error('late failure');
  });
  app.get(
    '/wrapped',
    asyncHandler(async () => {
      throw new AppError(409, 'wrapped');
    })
  );
  const safe = asyncSafeRouter();
  safe.get('/x', async () => {
    throw new AppError(422, 'safe router');
  });
  app.use('/safe', safe);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    errorHandlerCalls += 1;
    if (res.headersSent) return;
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json({ message: err instanceof Error ? err.message : 'error' });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  process.off('unhandledRejection', unhandled);
  await new Promise((r) => server.close(r));
});

beforeEach(() => {
  errorHandlerCalls = 0;
});

async function settle() {
  await new Promise((r) => setTimeout(r, 20));
}

describe('express async errors', () => {
  it('turns a thrown AppError in an unwrapped async route into its status', async () => {
    const res = await fetch(`${base}/throws`);
    expect(res.status).toBe(404);
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('turns a rejection with no reason into a 500', async () => {
    const res = await fetch(`${base}/rejects-undefined`);
    expect(res.status).toBe(500);
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('leaves successful async routes alone', async () => {
    const res = await fetch(`${base}/ok`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('does not crash when a handler fails after sending the response', async () => {
    const res = await fetch(`${base}/after-send`);
    expect(await res.json()).toEqual({ sent: true });
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('keeps asyncHandler behaviour: one error response', async () => {
    const res = await fetch(`${base}/wrapped`);
    expect(res.status).toBe(409);
    await settle();
    expect(errorHandlerCalls).toBe(1);
  });

  it('does not double-handle errors from asyncSafeRouter', async () => {
    const res = await fetch(`${base}/safe/x`);
    expect(res.status).toBe(422);
    await settle();
    expect(errorHandlerCalls).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
