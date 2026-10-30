/**
 * Build the backend bundle for the on-prem (exe) distribution. Separate from build-dist.mjs so the
 * Railway build is untouched.
 *
 *   node scripts/onprem/build-onprem-backend.mjs <outdir>
 *
 * Differences from the SaaS build:
 *   - __GATES_ONPREM_BUILD__ = true is compiled in: license enforcement cannot be switched off by env.
 *   - minified, no source maps (the TypeScript source does not ship to customers).
 *   - extra entries: onprem-setup.js (first-run DB setup) and license-cli.js (machine code / check).
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const outdir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist-onprem');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const started = Date.now();
await build({
  absWorkingDir: root,
  entryPoints: {
    index: 'src/index.ts',
    'onprem-setup': 'src/onprem/setup.ts',
    'license-cli': 'src/shared/onprem-license/cli.ts',
  },
  outdir,
  bundle: true,
  splitting: false,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  tsconfig: 'tsconfig.json',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: { __GATES_ONPREM_BUILD__: 'true' },
  banner: {
    js: [
      "import { createRequire as __gatesCreateRequire } from 'node:module';",
      "if (typeof globalThis.require === 'undefined') globalThis.require = __gatesCreateRequire(import.meta.url);",
    ].join('\n'),
  },
});
console.log(`on-prem backend bundle built in ${Date.now() - started} ms → ${outdir}`);
