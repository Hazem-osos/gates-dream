/**
 * RFC 6238 TOTP (Google Authenticator compatible): SHA-1, 6 digits, 30-second steps.
 * Secrets are stored AES-256-GCM encrypted with a key derived from the admin signing key.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deriveAdminKey } from './platform-admin-token';

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentStep(now: number = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Returns the matched time step (±1 step of clock drift), or null.
 * `lastStep` rejects a code that was already used.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastStep: number | null | undefined,
  now: number = Date.now()
): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    if (lastStep != null && s <= lastStep) continue;
    const expected = Buffer.from(totpCode(secretBase32, s));
    if (timingSafeEqual(expected, Buffer.from(clean))) return s;
  }
  return null;
}

export function totpUri(secretBase32: string, account: string, issuer = 'Gates Admin'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export function encryptSecret(plain: string): string {
  const key = deriveAdminKey('totp-secret');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) throw new Error('Unsupported TOTP secret format');
  const decipher = createDecipheriv('aes-256-gcm', deriveAdminKey('totp-secret'), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
