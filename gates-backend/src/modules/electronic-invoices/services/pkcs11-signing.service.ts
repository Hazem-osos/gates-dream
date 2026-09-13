import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { extname, resolve } from 'node:path';
import { AppError } from '../../../shared/middleware/error-handler';

export interface Pkcs11Config {
  modulePath: string;
  certLabel: string;
  slot: number;
  pin?: string;
}

export interface Pkcs11SignResult {
  signature: string;
  diagnostics: string[];
}

type PinCacheEntry = { pin: string; expiresAt: number };

const PIN_CACHE_TTL_MS = 15 * 60 * 1000;
let pinCache: PinCacheEntry | null = null;

function expectedModuleExtension(): string {
  if (process.platform === 'win32') return '.dll';
  if (process.platform === 'darwin') return '.dylib';
  return '.so';
}

export function getPkcs11Diagnostics(cfg: Pkcs11Config): string[] {
  return [
    `platform=${platform()} (${process.platform})`,
    `module=${cfg.modulePath}`,
    `slot=${cfg.slot}`,
    `certLabel=${cfg.certLabel}`,
    `pinSource=${cfg.pin ? 'env/cache' : 'missing'}`,
    `expectedExt=${expectedModuleExtension()}`,
  ];
}

export function validatePkcs11Environment(): Pkcs11Config {
  const modulePath = process.env.ETA_PKCS11_MODULE_PATH?.trim();
  const certLabel = process.env.ETA_PKCS11_CERT_LABEL?.trim();
  const slotRaw = process.env.ETA_PKCS11_SLOT?.trim() ?? '0';
  const pin = process.env.ETA_TOKEN_PIN?.trim() || process.env.ETA_PKCS11_PIN?.trim();

  if (!modulePath) {
    throw new AppError(
      501,
      'PKCS#11: set ETA_PKCS11_MODULE_PATH to the vendor library (.dll on Windows, .so on Linux).'
    );
  }
  if (!certLabel) {
    throw new AppError(
      501,
      'PKCS#11: set ETA_PKCS11_CERT_LABEL to the signing certificate label on the token.'
    );
  }

  const resolved = resolve(modulePath);
  if (!existsSync(resolved)) {
    throw new AppError(
      501,
      `PKCS#11 module not found at ${resolved}. Install the token driver and mount it into the container.`
    );
  }

  const ext = extname(resolved).toLowerCase();
  const expectedExt = expectedModuleExtension();
  if (ext && ext !== expectedExt && process.platform !== 'darwin') {
    throw new AppError(
      501,
      `PKCS#11 module ${resolved} has extension ${ext}; expected ${expectedExt} on ${process.platform}.`
    );
  }

  const slot = Number(slotRaw);
  if (!Number.isFinite(slot) || slot < 0) {
    throw new AppError(501, 'PKCS#11: ETA_PKCS11_SLOT must be a non-negative integer.');
  }

  return { modulePath: resolved, certLabel, slot, pin };
}

export function cachePin(pin: string) {
  pinCache = { pin, expiresAt: Date.now() + PIN_CACHE_TTL_MS };
}

export function getCachedPin(): string | undefined {
  if (!pinCache) return undefined;
  if (Date.now() > pinCache.expiresAt) {
    pinCache = null;
    return undefined;
  }
  return pinCache.pin;
}

/**
 * Async ETA signing via PKCS#11. Requires optional `pkcs11js` in the deployment image.
 */
export async function signWithPkcs11(
  document: Record<string, unknown>,
  pinOverride?: string
): Promise<Pkcs11SignResult> {
  const cfg = validatePkcs11Environment();
  const pin = pinOverride ?? cfg.pin ?? getCachedPin();
  if (!pin) {
    throw new AppError(
      501,
      'PKCS#11: set ETA_TOKEN_PIN or ETA_PKCS11_PIN, or pass tokenPin from e-invoice settings.'
    );
  }
  cachePin(pin);

  const canonical = JSON.stringify(document);
  const digest = createHash('sha256').update(canonical).digest();

  try {
    const mod = (await import('pkcs11js')) as {
      default?: unknown;
      PKCS11?: new () => Pkcs11Lib;
    };
    const Lib = mod.PKCS11 ?? mod.default;
    if (typeof Lib !== 'function') {
      throw new Error('pkcs11js export missing PKCS11 constructor');
    }
    const pkcs11 = new (Lib as new () => Pkcs11Lib)();
    pkcs11.load(cfg.modulePath);
    pkcs11.C_Initialize();
    try {
      throw new Error(
        'C_FindObjects/C_Sign binding not configured for this token vendor — extend pkcs11-signing.service.ts'
      );
    } finally {
      try {
        pkcs11.C_Finalize();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const hashPreview = digest.toString('hex').slice(0, 16);
    throw new AppError(
      501,
      [
        'PKCS#11 signing is configured but could not complete.',
        getPkcs11Diagnostics(cfg).join('; '),
        `payloadSha256=${hashPreview}…`,
        'Install pkcs11js + vendor PKCS#11 library, enable USB/HSM passthrough, and verify PIN/slot/label.',
        `Detail: ${detail}`,
      ].join(' ')
    );
  }
}

/** Adapter surface — extend with vendor-specific C_Sign wiring when pkcs11js is linked. */
interface Pkcs11Lib {
  load(path: string): void;
  C_Initialize(): void;
  C_Finalize(): void;
}

export function signMock(document: Record<string, unknown>): string {
  const canonical = JSON.stringify(document);
  return createHash('sha256').update(canonical).digest('base64');
}
