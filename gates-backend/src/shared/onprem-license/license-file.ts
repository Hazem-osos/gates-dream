/**
 * Reads and checks the on-prem license file. No database, no app config — safe to load from
 * the launcher CLI (cli.ts) as well as from the server.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyLicense, type LicenseCheckResult } from './license-codec';
import { GATES_LICENSE_PUBLIC_KEY_PEM } from './license-public-key';
import { getMachineId } from './machine-id';

export function licenseFilePath(): string {
  return path.resolve(process.env.GATES_LICENSE_FILE?.trim() || path.join(process.cwd(), 'gates.lic'));
}

export function checkLicenseFile(now = new Date()): LicenseCheckResult & { machineId: string } {
  const machineId = getMachineId();
  let text: string;
  try {
    text = readFileSync(licenseFilePath(), 'utf8');
  } catch {
    return { ok: false, reason: 'MISSING', machineId };
  }
  return { ...verifyLicense(text, GATES_LICENSE_PUBLIC_KEY_PEM, { machineId, now }), machineId };
}
