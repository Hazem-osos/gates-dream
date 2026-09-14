import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const standalone = path.join(root, '.next/standalone');
const server = path.join(standalone, 'server.js');

if (!existsSync(server)) {
  console.error('Missing .next/standalone/server.js. Build with output: "standalone".');
  process.exit(1);
}

function copyIfNeeded(from, to) {
  if (!existsSync(from) || existsSync(to)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyIfNeeded(path.join(root, '.next/static'), path.join(standalone, '.next/static'));
copyIfNeeded(path.join(root, 'public'), path.join(standalone, 'public'));

// Railway sets HOSTNAME to the container name. Next standalone binds that
// value, so healthchecks fail unless we force all interfaces.
process.env.HOSTNAME = '0.0.0.0';
if (!process.env.PORT) process.env.PORT = '8080';

const child = spawn(process.execPath, [server], {
  cwd: standalone,
  env: process.env,
  stdio: 'inherit',
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
