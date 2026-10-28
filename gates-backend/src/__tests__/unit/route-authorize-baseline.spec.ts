/**
 * Security regression guard: every route that changes data (POST/PUT/PATCH/DELETE) must
 * check a permission. `scripts/audit-route-authorize.mjs` parses all route files; the only
 * unguarded routes allowed are the reviewed ones in `scripts/route-authorize-baseline.json`,
 * each with its reason. A new unguarded route fails this test.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

function currentUnguarded(): string[] {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'audit-route-authorize.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out) as string[];
}

function baseline(): Record<string, string> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scripts', 'route-authorize-baseline.json'), 'utf8')
  ) as Record<string, string>;
  delete raw._comment;
  return raw;
}

describe('mutating routes need a permission guard', () => {
  const found = currentUnguarded();
  const allowed = baseline();

  it('has no new unguarded mutating route', () => {
    const fresh = found.filter((key) => !(key in allowed));
    expect(fresh).toEqual([]);
  });

  it('gives every allowed exception a reason', () => {
    for (const [key, reason] of Object.entries(allowed)) {
      expect(`${key}: ${reason.trim()}`.length).toBeGreaterThan(key.length + 10);
    }
  });

  it('keeps the baseline tidy (drop entries whose route is now guarded or removed)', () => {
    // An entry whose file is absent is skipped, not flagged: that module may live on another
    // branch (e.g. the migration engine) while this baseline is shared.
    const stale = Object.keys(allowed).filter((key) => {
      const file = key.split(' ')[0];
      return fs.existsSync(path.join(ROOT, file)) && !found.includes(key);
    });
    expect(stale).toEqual([]);
  });
});
