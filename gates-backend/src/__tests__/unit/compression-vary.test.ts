import { ACCEPT_ENCODING_VARY, appendVary } from '../../shared/http/vary';
import {
  COMPRESSION_THRESHOLD_BYTES,
  shouldSkipCompression,
} from '../../shared/middleware/compression.middleware';

function mockRes(initialVary?: string) {
  const headers: Record<string, string> = {};
  if (initialVary) headers.vary = initialVary;
  const res = {
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
  };
  return { res, headers };
}

describe('compression + Vary', () => {
  it('uses a 1KB threshold', () => {
    expect(COMPRESSION_THRESHOLD_BYTES).toBe(1024);
  });

  it('always sets Vary: Accept-Encoding and does not duplicate it', () => {
    const ctx = mockRes();
    appendVary(ctx.res as never, ACCEPT_ENCODING_VARY);
    appendVary(ctx.res as never, ACCEPT_ENCODING_VARY);
    expect(ctx.headers.vary).toBe('Accept-Encoding');
  });

  it('appends Accept-Encoding next to an existing Vary token', () => {
    const ctx = mockRes('Origin');
    appendVary(ctx.res as never, ACCEPT_ENCODING_VARY);
    expect(ctx.headers.vary).toBe('Origin, Accept-Encoding');
  });

  it('does not set headers after the response has started', () => {
    const ctx = mockRes();
    (ctx.res as { headersSent?: boolean }).headersSent = true;
    appendVary(ctx.res as never, ACCEPT_ENCODING_VARY);
    expect(ctx.headers.vary).toBeUndefined();
  });

  it('skips compression for SSE and AI chat', () => {
    expect(
      shouldSkipCompression({
        headers: { accept: 'text/event-stream, application/json' },
        originalUrl: '/api/v1/inventory/items',
        url: '/api/v1/inventory/items',
        path: '/api/v1/inventory/items',
      } as never)
    ).toBe(true);
    expect(
      shouldSkipCompression({
        headers: { accept: 'application/json' },
        originalUrl: '/api/v1/ai/chat',
        url: '/api/v1/ai/chat',
        path: '/api/v1/ai/chat',
      } as never)
    ).toBe(true);
    expect(
      shouldSkipCompression({
        headers: { accept: 'application/json' },
        originalUrl: '/api/v1/inventory/items',
        url: '/api/v1/inventory/items',
        path: '/api/v1/inventory/items',
      } as never)
    ).toBe(false);
  });
});
