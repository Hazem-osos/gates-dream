import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  applyMasterDataEtag,
  buildPayloadEtag,
  buildWeakEtag,
  ifNoneMatchHit,
  opaqueEtag,
  sendJsonWithEtag,
} from '../../shared/http/master-data-etag';
import { MASTER_DATA_CACHE_CONTROL } from '../../shared/http/http-cache-policy';

function mockReq(ifNoneMatch?: string): Request {
  return { headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {} } as Request;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let ended = false;
  let jsonBody: unknown;
  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
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

describe('master-data-etag', () => {
  it('builds a weak ETag and compares If-None-Match with or without W/', () => {
    const etag = buildWeakEtag(['co-1', 'account', new Date('2026-01-01T00:00:00.000Z')]);
    expect(etag.startsWith('W/"')).toBe(true);
    expect(ifNoneMatchHit(mockReq(etag), etag)).toBe(true);
    expect(ifNoneMatchHit(mockReq(`"${opaqueEtag(etag)}"`), etag)).toBe(true);
    expect(ifNoneMatchHit(mockReq('*'), etag)).toBe(true);
    expect(ifNoneMatchHit(mockReq('"other"'), etag)).toBe(false);
    expect(ifNoneMatchHit(mockReq(), etag)).toBe(false);
  });

  it('returns 304 with empty body when If-None-Match hits', () => {
    const etag = buildWeakEtag(['a', 1]);
    const ctx = mockRes();
    const notModified = applyMasterDataEtag(mockReq(etag), ctx.res, etag);
    expect(notModified).toBe(true);
    expect(ctx.statusCode).toBe(304);
    expect(ctx.ended).toBe(true);
    expect(ctx.headers.etag).toBe(etag);
    expect(ctx.headers['cache-control']).toBe(MASTER_DATA_CACHE_CONTROL);
    expect(ctx.headers.vary).toMatch(/Accept-Encoding/i);
    expect(ctx.jsonBody).toBeUndefined();
  });

  it('sends JSON when the validator does not match', () => {
    const etag = buildPayloadEtag({ ok: true });
    const expected = `"${createHash('sha1').update(JSON.stringify({ ok: true })).digest('hex')}"`;
    expect(etag).toBe(expected);
    const ctx = mockRes();
    sendJsonWithEtag(mockReq('"nope"'), ctx.res, etag, { status: 'success', data: [1] });
    expect(ctx.ended).toBe(false);
    expect(ctx.jsonBody).toEqual({ status: 'success', data: [1] });
  });
});
