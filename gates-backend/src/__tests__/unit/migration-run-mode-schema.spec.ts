import { describe, expect, it } from '@jest/globals';
import {
  runMigrationJobSchema,
  runModeRequiresTargetWriteConfirm,
} from '../../modules/migration-engine/schemas/migration-engine.schema';
import { preventSQLInjection } from '../../shared/middleware/sanitize.middleware';

describe('migration run mode — import alias', () => {
  it('normalises `import` to the internal `execute` mode', () => {
    const parsed = runMigrationJobSchema.parse({ mode: 'import', confirmTargetWrite: true });
    expect(parsed.mode).toBe('execute');
    expect(runModeRequiresTargetWriteConfirm(parsed.mode)).toBe(true);
  });

  it('still accepts the other modes unchanged', () => {
    for (const mode of ['analyze', 'dry-run', 'execute', 'reconcile', 'auto'] as const) {
      expect(runMigrationJobSchema.parse({ mode }).mode).toBe(mode);
    }
  });

  it('rejects unknown modes', () => {
    expect(() => runMigrationJobSchema.parse({ mode: 'wipe' })).toThrow();
  });

  it('the `import` body passes the shared sanitizer (the sanitizer itself is unchanged)', () => {
    const run = (body: unknown) => {
      let passed = false;
      let status = 0;
      const req = { body, query: {}, params: {}, path: '/api/v1/migration-engine/jobs/x/run', ip: '127.0.0.1', socket: {}, method: 'POST', originalUrl: '/api/v1/migration-engine/jobs/x/run', url: '/api/v1/migration-engine/jobs/x/run', get: () => undefined, headers: {} } as never;
      const res = { status(s: number) { status = s; return this; }, json() { return this; } } as never;
      preventSQLInjection(req, res, () => { passed = true; });
      return { passed, status };
    };
    expect(run({ mode: 'import', confirmTargetWrite: true }).passed).toBe(true);
    expect(run({ mode: 'execute', confirmTargetWrite: true }).passed).toBe(false);
  });
});
