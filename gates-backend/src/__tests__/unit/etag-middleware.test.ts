import type { NextFunction, Request, Response } from 'express';
import { etagMiddleware } from '../../shared/middleware/etag.middleware';
import { buildPayloadEtag } from '../../shared/http/master-data-etag';

function mockReq(ifNoneMatch?: string): Request {
  return {
    method: 'GET',
    path: '/api/v1/rbac/permissions',
    headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {},
  } as Request;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let ended = false;
  let jsonBody: unknown;
  const res = {
    statusCode,
    headersSent: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    end() {
      ended = true;
      return res;
    },
    json(body: unknown) {
      jsonBody = body;
      return res;
    },
  };
  return {
    res: res as unknown as Response,
    headers,
    get statusCode() {
      return statusCode;
    },
    get ended() {
      return ended;
    },
    get jsonBody() {
      return jsonBody;
    },
  };
}

describe('etagMiddleware', () => {
  it('returns 304 with empty body when If-None-Match matches the payload ETag', () => {
    const body = { status: 'success', data: [{ id: 1 }] };
    const etag = buildPayloadEtag(body);
    const ctx = mockRes();
    etagMiddleware(mockReq(etag), ctx.res, (() => undefined) as NextFunction);
    ctx.res.json(body);
    expect(ctx.statusCode).toBe(304);
    expect(ctx.ended).toBe(true);
    expect(ctx.jsonBody).toBeUndefined();
    expect(ctx.headers.etag).toBe(etag);
    expect(ctx.headers.vary).toMatch(/Accept-Encoding/i);
  });

  it('sends the JSON body when If-None-Match does not match', () => {
    const body = { status: 'success', data: [{ id: 1 }] };
    const ctx = mockRes();
    etagMiddleware(mockReq('"nope"'), ctx.res, (() => undefined) as NextFunction);
    ctx.res.json(body);
    expect(ctx.ended).toBe(false);
    expect(ctx.jsonBody).toEqual(body);
    expect(ctx.headers.etag).toBe(buildPayloadEtag(body));
  });
});
