import type { NextFunction, Request, Response } from 'express';
import {
  aiRequestTimeout,
  defaultRequestTimeout,
  reportRequestTimeout,
  requestTimeout,
} from '../../shared/middleware/request-timeout.middleware';

function mockReq(url = '/api/v1/inventory/items'): Request {
  return {
    method: 'GET',
    path: url,
    url,
    originalUrl: url,
    ip: '127.0.0.1',
  } as Request;
}

function mockRes() {
  const listeners: Record<string, Array<() => void>> = { finish: [], close: [] };
  const res = {
    headersSent: false,
    writableEnded: false,
    locals: {} as Record<string, unknown>,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      if (res.headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client') as NodeJS.ErrnoException;
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      if (res.headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client') as NodeJS.ErrnoException;
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      res.headersSent = true;
      res.writableEnded = true;
      res.body = body;
      return res;
    },
    once(event: string, fn: () => void) {
      listeners[event]?.push(fn);
      return res;
    },
    emit(event: string) {
      for (const fn of listeners[event] ?? []) fn();
    },
  };
  return res as typeof res & Response;
}

describe('requestTimeout middleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('replaces the global 30s timer when a longer route timeout is applied', () => {
    const req = mockReq('/api/v1/executive/overview');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    defaultRequestTimeout(req, res, next);
    reportRequestTimeout(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.body).toBeUndefined();

    jest.advanceTimersByTime(30_000);
    expect(res.statusCode).toBe(408);
    expect(res.body).toEqual({ status: 'error', message: 'Request timeout' });
  });

  it('gives AI chat the 180s window after skipping the default timer', () => {
    const req = mockReq('/api/v1/ai/chat');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    defaultRequestTimeout(req, res, next);
    aiRequestTimeout(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.body).toBeUndefined();

    jest.advanceTimersByTime(150_000);
    expect(res.statusCode).toBe(408);
    expect(res.body).toEqual({ status: 'error', message: 'Request timeout' });
  });

  it('does not attach the default 30s timeout to AI routes', () => {
    const req = mockReq('/api/v1/ai/chat');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    defaultRequestTimeout(req, res, next);
    jest.advanceTimersByTime(30_000);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('does not throw if the handler already sent the response', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    const mw = requestTimeout({ timeout: 1_000 });

    mw(req, res, next);
    res.json({ status: 'success' });

    expect(() => jest.advanceTimersByTime(1_000)).not.toThrow();
    expect(res.body).toEqual({ status: 'success' });
  });
});
