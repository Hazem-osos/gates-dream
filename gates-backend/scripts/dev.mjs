import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const require = createRequire(import.meta.url);
const compiled = path.join(root, 'dist/src/index.js');

function macFileTable() {
  try {
    const num = Number(execSync('sysctl -n kern.num_files', { encoding: 'utf8' }).trim());
    const max = Number(execSync('sysctl -n kern.maxfiles', { encoding: 'utf8' }).trim());
    return { num, max, tight: Number.isFinite(num) && Number.isFinite(max) && max > 0 && num / max >= 0.85 };
  } catch {
    return { num: 0, max: 0, tight: false };
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      cwd: root,
      env: process.env,
    });
    const forward = (signal) => {
      if (!child.killed) child.kill(signal);
    };
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      if (signal) process.exit(0);
      resolve(code ?? 1);
    });
  });
}

async function runCompiled(reason) {
  if (!existsSync(compiled)) {
    console.error(`[dev] ${reason} dist/src/index.js is missing. Run: npm run build`);
    process.exit(1);
  }
  console.warn(`[dev] ${reason} Using compiled server (no tsx/esbuild).`);
  process.exit(await run(['--enable-source-maps', compiled]));
}

const table = macFileTable();
if (table.tight) {
  await runCompiled(`macOS file table is tight (${table.num}/${table.max}).`);
}

try {
  const tsxCli = require.resolve('tsx/cli');
  process.exit(await run([tsxCli, 'watch', 'src/index.ts']));
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'ENFILE' || code === 'EMFILE') {
    await runCompiled(`${code}: cannot spawn tsx/esbuild.`);
  }
  throw error;
}
