/**
 * Machine code for the on-prem license: a short, stable fingerprint of the server it runs on.
 *
 * Windows (the product target) combines two identifiers, so copying the program folder — or
 * cloning just the disk to different hardware — gives a different code:
 *   - the Windows installation id   HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 *   - the motherboard/BIOS UUID      Win32_ComputerSystemProduct.UUID
 * macOS / Linux are supported only so the flow can be tested on a developer machine.
 *
 * The raw identifiers never leave the machine: only a salted SHA-256 prefix is shown.
 * If an identifier cannot be read we fail rather than fall back, because a fallback would
 * silently produce a different code and lock the customer out on the next start.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SALT = 'gates-erp-onprem-machine-v1';
const EXEC_TIMEOUT_MS = 15_000;

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    timeout: EXEC_TIMEOUT_MS,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function windowsSources(): string[] {
  const reg = run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
  const guid = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/.exec(reg)?.[1];
  if (!guid) throw new Error('تعذر قراءة MachineGuid من الريجستري');

  const bios = run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID',
  ]).trim();
  if (!/^[0-9a-fA-F-]{32,36}$/.test(bios)) throw new Error('تعذر قراءة UUID اللوحة الأم');

  return [`win-guid:${guid.toLowerCase()}`, `bios-uuid:${bios.toLowerCase()}`];
}

function macSources(): string[] {
  const out = run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
  const uuid = /"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]+)"/.exec(out)?.[1];
  if (!uuid) throw new Error('could not read IOPlatformUUID');
  return [`mac-uuid:${uuid.toLowerCase()}`];
}

function linuxSources(): string[] {
  const id = readFileSync('/etc/machine-id', 'utf8').trim();
  if (!id) throw new Error('could not read /etc/machine-id');
  return [`linux-machine-id:${id}`];
}

/** Formats 20 hex chars as XXXXX-XXXXX-XXXXX-XXXXX. */
export function formatMachineId(hex20: string): string {
  return hex20.toUpperCase().match(/.{5}/g)!.join('-');
}

export function machineIdFromSources(sources: string[]): string {
  const digest = createHash('sha256').update([SALT, ...sources].join('|')).digest('hex');
  return formatMachineId(digest.slice(0, 20));
}

let cached: string | null = null;

export function getMachineId(): string {
  if (cached) return cached;
  const sources =
    process.platform === 'win32'
      ? windowsSources()
      : process.platform === 'darwin'
        ? macSources()
        : linuxSources();
  cached = machineIdFromSources(sources);
  return cached;
}
