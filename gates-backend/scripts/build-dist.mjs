/**
 * Compile the backend to plain JavaScript in dist/ so production runs on `node`
 * instead of transpiling TypeScript at runtime with `tsx`.
 *
 * Why a bundle (esbuild) rather than `tsc`: the code uses `moduleResolution:
 * "bundler"` — extensionless relative imports and `@/…` path aliases — which
 * Node's ESM loader cannot resolve from per-file `tsc` output. esbuild resolves
 * both and keeps every npm package external (they still load from node_modules).
 *
 * Runtime paths are unaffected: all file access in src/ is relative to
 * process.cwd(), which is still the gates-backend directory.
 *
 *   node scripts/build-dist.mjs        # writes dist/index.js, dist/workers/index.js
 *
 * scripts/railway-start.mjs runs dist/ when it exists and falls back to tsx
 * otherwise (or when GATES_RUNTIME=tsx is set — the rollback switch).
 */
import { build } from 'esbuild';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const outdir = path.join(root, 'dist');

rmSync(outdir, { recursive: true, force: true });

const started = Date.now();
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts', 'src/workers/index.ts'],
  outbase: 'src',
  outdir: 'dist',
  bundle: true,
  // No code splitting: with chunks, app modules (e.g. env validation) could be
  // evaluated before an entry's own first import (`dotenv/config`) ran. One file
  // per entry keeps tsx's order — every npm import first, then app code in source
  // order. Dynamic import() of app modules stays lazy (esbuild wraps them).
  splitting: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  packages: 'external',
  tsconfig: 'tsconfig.json',
  sourcemap: true,
  metafile: true,
  logLevel: 'warning',
  // Bundled CommonJS (scripts/lib/*.cjs) calls `require`; ES modules have none.
  // esbuild's shim uses a global `require` when one exists. Named so it cannot
  // collide with a module's own `const require = createRequire(...)`.
  banner: {
    js: [
      "import { createRequire as __gatesCreateRequire } from 'node:module';",
      "if (typeof globalThis.require === 'undefined') globalThis.require = __gatesCreateRequire(import.meta.url);",
    ].join('\n'),
  },
});

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const outputs = Object.keys(result.metafile.outputs).filter((f) => f.endsWith('.js'));
writeFileSync(
  path.join(outdir, 'build-info.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      name: pkg.name,
      node: process.version,
      jsFiles: outputs.length,
    },
    null,
    2
  ) + '\n'
);

console.log(`dist/ built in ${Date.now() - started} ms (${outputs.length} JS files).`);
