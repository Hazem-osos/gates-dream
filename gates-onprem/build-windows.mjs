#!/usr/bin/env node
/**
 * Build the Gates ERP on-prem Windows package (GatesERP.exe + app folder) on a Mac/Linux build box.
 *
 *   node gates-onprem/build-windows.mjs [--skip-web-build]
 *
 * Expects `next build` to have been run in gates-web with
 *   NEXT_PUBLIC_API_URL=  BACKEND_PROXY_TARGET=http://127.0.0.1:3001
 * (the rewrite target is baked in at build time). Pass --build-web to run it here.
 *
 * Output: gates-onprem/out/GatesERP-<version>-win-x64/ and a .zip of it.
 * Network: npm registry (Windows packages), binaries.prisma.sh (Windows query engine),
 * nodejs.org (official node.exe, checked against SHASUMS256.txt).
 * Never ships: .env files, private keys, source maps, TypeScript source.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BACKEND_SRC = path.join(REPO, 'gates-backend');
const WEB_SRC = path.join(REPO, 'gates-web');
const CACHE = path.join(HERE, '.cache');
const NAME = `GatesERP-${VERSION}-win-x64`;
const OUT_ROOT = path.join(HERE, 'out');
const OUT = path.join(OUT_ROOT, NAME);
const APP_BACKEND = path.join(OUT, 'app', 'backend');
const APP_WEB = path.join(OUT, 'app', 'web');
const PRISMA_BIN = path.join(BACKEND_SRC, 'node_modules', '.bin', 'prisma');
const PKG_BIN = path.join(REPO, 'gates-migration-connector', 'node_modules', '.bin', 'pkg');

function step(msg) {
  console.log(`\n▶ ${msg}`);
}
function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}
function capture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}
function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

mkdirSync(CACHE, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1) Backend bundle (licensing compiled in, minified, no source maps)
step('Backend bundle');
run(process.execPath, [path.join(BACKEND_SRC, 'scripts', 'onprem', 'build-onprem-backend.mjs'), APP_BACKEND]);
writeFileSync(
  path.join(APP_BACKEND, 'package.json'),
  JSON.stringify({ name: 'gates-erp-onprem-backend', version: VERSION, private: true, type: 'module' }, null, 2)
);

// 2) Backend production dependencies for Windows x64 (cached by lockfile hash)
step('Backend dependencies (win32-x64)');
const lockHash = createHash('sha256')
  .update(readFileSync(path.join(BACKEND_SRC, 'package-lock.json')))
  .update(readFileSync(path.join(BACKEND_SRC, 'prisma', 'schema.prisma')))
  .digest('hex')
  .slice(0, 16);
const depsDir = path.join(CACHE, `backend-deps-${lockHash}`);
if (!existsSync(path.join(depsDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'))) {
  rmSync(depsDir, { recursive: true, force: true });
  mkdirSync(path.join(depsDir, 'prisma'), { recursive: true });
  cpSync(path.join(BACKEND_SRC, 'package.json'), path.join(depsDir, 'package.json'));
  cpSync(path.join(BACKEND_SRC, 'package-lock.json'), path.join(depsDir, 'package-lock.json'));
  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--os=win32', '--cpu=x64', '--no-audit', '--no-fund'], { cwd: depsDir });

  // Prisma client with the Windows query engine. The shared schema is not edited:
  // a copy gets the extra binary target.
  const schema = readFileSync(path.join(BACKEND_SRC, 'prisma', 'schema.prisma'), 'utf8');
  const winSchema = schema.replace(/binaryTargets\s*=\s*\[[^\]]*\]/, 'binaryTargets   = ["native", "windows"]');
  if (winSchema === schema) throw new Error('could not set binaryTargets in the schema copy');
  writeFileSync(path.join(depsDir, 'prisma', 'schema.prisma'), winSchema);
  run(PRISMA_BIN, ['generate', '--schema', path.join(depsDir, 'prisma', 'schema.prisma')], { cwd: depsDir });
  if (!existsSync(path.join(depsDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'))) {
    throw new Error('Prisma Windows query engine was not generated');
  }
}
cpSync(path.join(depsDir, 'node_modules'), path.join(APP_BACKEND, 'node_modules'), { recursive: true, verbatimSymlinks: true });
// Only the Windows query engine ships; drop the build box's own ("native") engine.
for (const name of readdirSync(path.join(APP_BACKEND, 'node_modules', '.prisma', 'client'))) {
  if (/^libquery_engine-|^query_engine-(?!windows)/.test(name)) rmSync(path.join(APP_BACKEND, 'node_modules', '.prisma', 'client', name));
}

// 3) Database bootstrap: full current schema as SQL + the migration history to record
step('Database bootstrap files');
let baseline = capture(PRISMA_BIN, [
  'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(BACKEND_SRC, 'prisma', 'schema.prisma'), '--script',
], { cwd: BACKEND_SRC });
// MySQL rejects a literal default on TEXT (docs/migration/PRISMA_FRESH_INSTALL_BASELINE.md).
baseline = baseline.replace(/(`\w+` (?:TINY|MEDIUM|LONG)?TEXT NOT NULL) DEFAULT ''/g, "$1 DEFAULT ('')");
const midLineSemicolons = baseline.split('\n').filter((l) => !l.trim().startsWith('--') && /;./.test(l.trim()));
if (midLineSemicolons.length) throw new Error(`baseline.sql has ';' inside a line — splitter unsafe:\n${midLineSemicolons.slice(0, 3).join('\n')}`);
mkdirSync(path.join(APP_BACKEND, 'bootstrap'), { recursive: true });
writeFileSync(path.join(APP_BACKEND, 'bootstrap', 'baseline.sql'), baseline);
const migSrc = path.join(BACKEND_SRC, 'prisma', 'migrations');
const migDst = path.join(APP_BACKEND, 'prisma', 'migrations');
mkdirSync(migDst, { recursive: true });
let migCount = 0;
for (const name of readdirSync(migSrc).sort()) {
  const sql = path.join(migSrc, name, 'migration.sql');
  if (statSync(path.join(migSrc, name)).isDirectory() && existsSync(sql)) {
    mkdirSync(path.join(migDst, name));
    cpSync(sql, path.join(migDst, name, 'migration.sql'));
    migCount++;
  }
}
console.log(`  baseline.sql ${Math.round(baseline.length / 1024)} KB, ${migCount} migrations recorded`);

// 4) Web app (Next.js standalone)
step('Web app');
if (process.argv.includes('--build-web')) {
  run('npx', ['next', 'build'], {
    cwd: WEB_SRC,
    env: { ...process.env, NEXT_PUBLIC_API_URL: '', BACKEND_PROXY_TARGET: 'http://127.0.0.1:3001', NEXT_TELEMETRY_DISABLED: '1' },
  });
}
const standalone = path.join(WEB_SRC, '.next', 'standalone');
if (!existsSync(path.join(standalone, 'server.js'))) throw new Error('gates-web/.next/standalone/server.js missing — run next build first');
const routes = readFileSync(path.join(WEB_SRC, '.next', 'routes-manifest.json'), 'utf8');
if (!routes.includes('http://127.0.0.1:3001/api/v1')) throw new Error('web build does not proxy /api/v1 to 127.0.0.1:3001 — rebuild with BACKEND_PROXY_TARGET');
cpSync(standalone, APP_WEB, { recursive: true, verbatimSymlinks: true });
cpSync(path.join(WEB_SRC, '.next', 'static'), path.join(APP_WEB, '.next', 'static'), { recursive: true });
if (existsSync(path.join(WEB_SRC, 'public'))) cpSync(path.join(WEB_SRC, 'public'), path.join(APP_WEB, 'public'), { recursive: true });

// The standalone build carries this build box's native image library (sharp). Swap in the
// Windows x64 build of the exact version sharp expects.
const imgDir = path.join(APP_WEB, 'node_modules', '@img');
const sharpPkgFile = path.join(APP_WEB, 'node_modules', 'sharp', 'package.json');
if (existsSync(sharpPkgFile)) {
  const sharpPkg = JSON.parse(readFileSync(sharpPkgFile, 'utf8'));
  const winVersion = sharpPkg.optionalDependencies?.['@img/sharp-win32-x64'];
  if (!winVersion) throw new Error('sharp does not list @img/sharp-win32-x64');
  if (existsSync(imgDir)) {
    for (const name of readdirSync(imgDir)) {
      if (/darwin|linux|linuxmusl/.test(name)) rmSync(path.join(imgDir, name), { recursive: true, force: true });
    }
  }
  const packDir = path.join(CACHE, `sharp-win32-x64-${winVersion}`);
  if (!existsSync(path.join(packDir, 'package', 'package.json'))) {
    rmSync(packDir, { recursive: true, force: true });
    mkdirSync(packDir, { recursive: true });
    const tgz = capture('npm', ['pack', `@img/sharp-win32-x64@${winVersion}`, '--pack-destination', packDir, '--silent'], { cwd: packDir }).trim().split('\n').pop();
    run('tar', ['-xzf', path.join(packDir, tgz), '-C', packDir]);
  }
  mkdirSync(imgDir, { recursive: true });
  cpSync(path.join(packDir, 'package'), path.join(imgDir, 'sharp-win32-x64'), { recursive: true });
  console.log(`  image library: @img/sharp-win32-x64@${winVersion}`);
}

// 5) Official Node.js runtime for Windows
step('Node.js runtime (win-x64)');
const sums = capture('curl', ['-fsSL', '--max-time', '60', 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt']);
const m = /^([0-9a-f]{64})\s+(node-v22\.[\d.]+-win-x64\.zip)$/m.exec(sums);
if (!m) throw new Error('could not find node win-x64 zip in SHASUMS256.txt');
const [, zipSha, zipName] = m;
const zipPath = path.join(CACHE, zipName);
if (!existsSync(zipPath) || sha256File(zipPath) !== zipSha) {
  run('curl', ['-fL', '--max-time', '600', '-o', zipPath, `https://nodejs.org/dist/latest-v22.x/${zipName}`]);
}
if (sha256File(zipPath) !== zipSha) throw new Error('node zip checksum mismatch');
const unz = path.join(CACHE, 'node-unzip');
rmSync(unz, { recursive: true, force: true });
run('unzip', ['-q', zipPath, '*/node.exe', '-d', unz]);
mkdirSync(path.join(OUT, 'runtime'), { recursive: true });
cpSync(path.join(unz, zipName.replace(/\.zip$/, ''), 'node.exe'), path.join(OUT, 'runtime', 'node.exe'));
console.log(`  ${zipName} (sha256 verified)`);

// 6) Launcher → GatesERP.exe
step('GatesERP.exe');
run(PKG_BIN, [
  path.join(HERE, 'launcher', 'launcher.js'),
  '--targets', 'node22-win-x64',
  // Same flags as GatesMigrationAgent.exe: bytecode needs an x64 node on this arm64 build box.
  // The launcher holds no secrets; licensing is enforced inside the backend.
  '--no-bytecode', '--public', '--public-packages', '*',
  '--output', path.join(OUT, 'GatesERP.exe'),
]);

// 7) Customer readme
cpSync(path.join(HERE, 'README-CUSTOMER.txt'), path.join(OUT, 'README.txt'));

// 8) Safety scan — nothing secret, no dev env files, no source maps
step('Safety scan');
const problems = [];
for (const f of walk(OUT)) {
  const base = path.basename(f);
  if (/^\.env/.test(base)) problems.push(`env file: ${f}`);
  if (/\.(pem|key|pfx|p12|bak|sql\.gz)$/i.test(base)) problems.push(`key/backup file: ${f}`);
  if (f.startsWith(APP_BACKEND) && !f.includes('node_modules') && base.endsWith('.map')) problems.push(`source map: ${f}`);
  if (statSync(f).size < 8 * 1024 * 1024 && !f.includes('node_modules') && /\.(js|json|txt|sql)$/.test(base)) {
    if (readFileSync(f, 'utf8').includes('PRIVATE KEY-----')) problems.push(`private key text in: ${f}`);
  }
}
if (problems.length) {
  // Remove dev env files copied by Next; anything else stops the build.
  for (const p of problems.filter((x) => x.startsWith('env file: '))) rmSync(p.slice('env file: '.length));
  const blocking = problems.filter((x) => !x.startsWith('env file: '));
  if (blocking.length) throw new Error(`refusing to package:\n${blocking.join('\n')}`);
  console.log(`  removed ${problems.length} dev env file(s) copied by the web build`);
}
console.log('  clean');

// 9) Zip
step('Zip');
const zipOut = path.join(OUT_ROOT, `${NAME}.zip`);
rmSync(zipOut, { force: true });
run('zip', ['-qry', zipOut, NAME], { cwd: OUT_ROOT });

const exe = path.join(OUT, 'GatesERP.exe');
console.log(`\n✔ Done\n  folder : ${OUT}\n  exe    : ${exe}  sha256 ${sha256File(exe)}\n  zip    : ${zipOut}  ${Math.round(statSync(zipOut).size / 1024 / 1024)} MB  sha256 ${sha256File(zipOut)}`);
