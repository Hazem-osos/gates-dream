#!/usr/bin/env tsx
/**
 * Gates on-prem license tool — run ONLY on the license issuer's own machine.
 *
 *   # issue a license for a customer's server (machine code comes from the customer's GatesERP.exe)
 *   npx tsx scripts/onprem/license-tool.ts issue \
 *       --machine ABCDE-12345-ABCDE-12345 --customer "شركة النور" --users 10 \
 *       --expires 2027-12-31          # or: --expires never
 *       [--out ./gates.lic]
 *
 *   # read any license file (signature checked, machine not checked)
 *   npx tsx scripts/onprem/license-tool.ts inspect ./gates.lic
 *
 *   # list every license issued from this machine
 *   npx tsx scripts/onprem/license-tool.ts list
 *
 * The private key is read from GATES_LICENSE_PRIVATE_KEY (a path) or
 * ~/.gates-license/gates-license-private.pem. It is never printed, never written by this tool,
 * and must never be committed — the repository is public. Every issued license is appended to
 * ~/.gates-license/issued.jsonl (customer names stay off the repository too).
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {
  LICENSE_PRODUCT,
  normalizeMachineId,
  signLicense,
  verifyLicense,
  type OnPremLicensePayload,
} from '../../src/shared/onprem-license/license-codec';
import { formatMachineId } from '../../src/shared/onprem-license/machine-id';
import { GATES_LICENSE_PUBLIC_KEY_PEM } from '../../src/shared/onprem-license/license-public-key';

const HOME_DIR = path.join(os.homedir(), '.gates-license');
const LEDGER = path.join(HOME_DIR, 'issued.jsonl');

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function args(): Map<string, string> {
  const map = new Map<string, string>();
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) map.set(argv[i].slice(2), argv[i + 1] ?? '');
  }
  return map;
}

function loadPrivateKey(): string {
  const keyPath = process.env.GATES_LICENSE_PRIVATE_KEY?.trim() || path.join(HOME_DIR, 'gates-license-private.pem');
  if (!existsSync(keyPath)) fail(`private key not found at ${keyPath}`);
  const pem = readFileSync(keyPath, 'utf8');
  // Refuse a key that does not match the public key compiled into the app.
  const derived = createPublicKey(createPrivateKey(pem)).export({ type: 'spki', format: 'pem' }).toString();
  if (derived.trim() !== GATES_LICENSE_PUBLIC_KEY_PEM.trim()) {
    fail('this private key does not match the public key built into the app (license-public-key.ts)');
  }
  return pem;
}

function parseExpiry(raw: string | undefined): string | null {
  if (!raw) fail('--expires is required: a date (YYYY-MM-DD) or "never"');
  if (raw === 'never') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail('--expires must be YYYY-MM-DD or "never"');
  // Valid through the whole of that day (Cairo is UTC+2/+3; end of day UTC covers it).
  const iso = `${raw}T23:59:59.000Z`;
  if (Number.isNaN(Date.parse(iso))) fail(`invalid date: ${raw}`);
  if (Date.parse(iso) < Date.now()) fail(`expiry ${raw} is already in the past`);
  return iso;
}

function issue(): void {
  const a = args();
  const machineRaw = normalizeMachineId(a.get('machine') ?? '');
  if (machineRaw.length !== 20) fail('--machine must be the 20-character code shown by GatesERP.exe (XXXXX-XXXXX-XXXXX-XXXXX)');
  const customer = (a.get('customer') ?? '').trim();
  if (!customer) fail('--customer is required');
  const users = Number(a.get('users'));
  if (!Number.isInteger(users) || users < 1 || users > 100_000) fail('--users must be a whole number ≥ 1');

  const payload: OnPremLicensePayload = {
    product: LICENSE_PRODUCT,
    licenseId: randomUUID(),
    customer,
    machineId: formatMachineId(machineRaw),
    maxUsers: users,
    issuedAt: new Date().toISOString(),
    expiresAt: parseExpiry(a.get('expires')),
  };
  const license = signLicense(payload, loadPrivateKey());

  // Self-check with the same code path the app uses.
  const check = verifyLicense(license, GATES_LICENSE_PUBLIC_KEY_PEM, { machineId: payload.machineId, now: new Date() });
  if (!check.ok) fail(`self-check failed: ${check.reason}`);

  const out = path.resolve(a.get('out') || 'gates.lic');
  writeFileSync(out, `${license}\n`);
  appendFileSync(LEDGER, `${JSON.stringify({ ...payload, file: out })}\n`, { mode: 0o600 });

  console.log('✔ License issued');
  console.log(`  customer   : ${payload.customer}`);
  console.log(`  machine    : ${payload.machineId}`);
  console.log(`  max users  : ${payload.maxUsers}`);
  console.log(`  expires    : ${payload.expiresAt ?? 'never (permanent)'}`);
  console.log(`  license id : ${payload.licenseId}`);
  console.log(`  file       : ${out}`);
  console.log('  Send this file to the customer. They put it next to GatesERP.exe as "gates.lic".');
}

function decodePayload(text: string): OnPremLicensePayload | null {
  try {
    return JSON.parse(Buffer.from(text.trim().split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function inspect(): void {
  const file = process.argv[3];
  if (!file) fail('usage: inspect <file.lic>');
  const text = readFileSync(file, 'utf8');
  const payload = decodePayload(text);
  if (!payload) fail('not a Gates license file');
  // Check against its own machine id: proves the signature and expiry, not the machine.
  const check = verifyLicense(text, GATES_LICENSE_PUBLIC_KEY_PEM, { machineId: payload.machineId, now: new Date() });
  console.log(JSON.stringify({ signature: check.ok || check.reason !== 'BAD_SIGNATURE' ? 'valid' : 'INVALID', status: check.ok ? 'OK' : check.reason, ...payload }, null, 2));
}

function list(): void {
  if (!existsSync(LEDGER)) {
    console.log('No licenses issued yet.');
    return;
  }
  const rows = readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  console.table(
    rows.map((r) => ({
      issued: r.issuedAt.slice(0, 10),
      customer: r.customer,
      machine: r.machineId,
      users: r.maxUsers,
      expires: r.expiresAt ? r.expiresAt.slice(0, 10) : 'never',
      id: r.licenseId.slice(0, 8),
    }))
  );
}

const command = process.argv[2];
if (command === 'issue') issue();
else if (command === 'inspect') inspect();
else if (command === 'list') list();
else fail('usage: license-tool.ts issue | inspect <file> | list');
