import { createBrotliCompress, constants as zlibConstants } from 'node:zlib';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { ACCEPT_ENCODING_VARY, appendVary } from '../http/vary';

export const COMPRESSION_THRESHOLD_BYTES = 1024;

function acceptsBrotli(req: Request): boolean {
  const accept = String(req.headers['accept-encoding'] ?? '');
  return /\bbr\b/.test(accept);
}

/** SSE / AI chat must write live chunks — buffering compression breaks the stream. */
export function shouldSkipCompression(req: Request): boolean {
  const accept = String(req.headers.accept ?? '');
  if (accept.includes('text/event-stream')) return true;
  const url = (req.originalUrl || req.url || req.path).split('?')[0] ?? '';
  return url.startsWith('/api/v1/ai');
}

function isEventStream(res: Response): boolean {
  return String(res.getHeader('Content-Type') ?? '').includes('text/event-stream');
}

function isCompressible(req: Request, res: Response): boolean {
  if (req.headers['x-no-compression']) return false;
  if (res.getHeader('Content-Encoding')) return false;
  return compression.filter(req, res);
}

/**
 * Brotli when the client advertises `br`; otherwise gzip/deflate via `compression`.
 * Only responses larger than 1KB are compressed.
 */
function brotliMiddleware(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  let finished = false;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  const collect = (chunk: unknown, encoding?: BufferEncoding): void => {
    if (chunk == null || chunk === '') return;
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      return;
    }
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, encoding));
      return;
    }
    chunks.push(Buffer.from(chunk as ArrayBuffer));
  };

  const unwrap = () => {
    res.write = originalWrite;
    res.end = originalEnd;
  };

  res.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error) => void), cb?: (error?: Error) => void) => {
    if (isEventStream(res)) {
      unwrap();
      for (const buffered of chunks) originalWrite(buffered);
      return originalWrite(chunk, encoding as never, cb as never);
    }
    const enc = typeof encoding === 'function' ? undefined : encoding;
    const done = typeof encoding === 'function' ? encoding : cb;
    collect(chunk, enc);
    if (done) done();
    return true;
  }) as Response['write'];

  res.end = ((chunk?: unknown, encoding?: BufferEncoding | ((error?: Error) => void), cb?: (error?: Error) => void) => {
    if (finished) return res;
    finished = true;
    const enc = typeof encoding === 'function' ? undefined : encoding;
    const done = typeof encoding === 'function' ? encoding : cb;
    collect(chunk, enc);

    unwrap();

    const body = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
    if (res.headersSent || isEventStream(res)) {
      originalEnd(body.length ? body : undefined, done);
      return res;
    }
    appendVary(res, ACCEPT_ENCODING_VARY);
    if (body.length < COMPRESSION_THRESHOLD_BYTES || !isCompressible(req, res)) {
      originalEnd(body, done);
      return res;
    }

    const brotli = createBrotliCompress({
      params: {
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });

    const out: Buffer[] = [];
    brotli.on('data', (d: Buffer) => out.push(d));
    brotli.on('error', () => {
      originalEnd(body, done);
    });
    brotli.on('end', () => {
      const compressed = Buffer.concat(out);
      if (!res.headersSent) {
        res.setHeader('Content-Encoding', 'br');
        appendVary(res, ACCEPT_ENCODING_VARY);
        res.setHeader('Content-Length', String(compressed.length));
      }
      originalEnd(compressed, done);
    });
    brotli.end(body);
    return res;
  }) as Response['end'];

  next();
}

const gzipCompressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) return false;
    if (isEventStream(res)) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: COMPRESSION_THRESHOLD_BYTES,
});

/** Prefer Brotli, fall back to gzip/deflate. JSON over 1KB is compressed. */
export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipCompression(req)) {
    next();
    return;
  }
  appendVary(res, ACCEPT_ENCODING_VARY);
  if (acceptsBrotli(req)) {
    brotliMiddleware(req, res, next);
    return;
  }
  gzipCompressionMiddleware(req, res, next);
}
