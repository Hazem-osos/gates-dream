import { buildCorsOptions, getCorsAllowedOrigins } from '../../shared/config/cors-options';

describe('cors-options', () => {
  it('merges FRONTEND_URL with CORS_ORIGINS', () => {
    const origins = getCorsAllowedOrigins();
    expect(origins).toContain('http://localhost:3000');
    expect(origins).toContain('https://app.example.com');
    expect(origins).toContain('https://staging.example.com');
  });

  it('allows requests with no Origin header (e.g. curl, mobile)', (done) => {
    const opts = buildCorsOptions();
    const originFn = opts.origin as (
      o: string | undefined,
      cb: (err: Error | null, ok?: boolean) => void
    ) => void;
    originFn(undefined, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  it('exposes ETag and allows If-None-Match', () => {
    const opts = buildCorsOptions();
    expect(opts.allowedHeaders).toEqual(expect.arrayContaining(['If-None-Match']));
    expect(opts.exposedHeaders).toEqual(expect.arrayContaining(['ETag']));
  });

  it('allows Railway preview origins when CORS_ALLOW_RAILWAY is on', (done) => {
    const previous = process.env.CORS_ALLOW_RAILWAY;
    process.env.CORS_ALLOW_RAILWAY = 'true';
    const opts = buildCorsOptions();
    const originFn = opts.origin as (
      o: string | undefined,
      cb: (err: Error | null, ok?: boolean) => void
    ) => void;
    originFn('https://gates-web-production.up.railway.app', (err, ok) => {
      process.env.CORS_ALLOW_RAILWAY = previous;
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  it('rejects unknown origins', (done) => {
    const opts = buildCorsOptions();
    const originFn = opts.origin as (
      o: string | undefined,
      cb: (err: Error | null, ok?: boolean) => void
    ) => void;
    originFn('https://evil.example', (err, ok) => {
      expect(err).toBeInstanceOf(Error);
      expect(ok).toBeUndefined();
      done();
    });
  });
});
