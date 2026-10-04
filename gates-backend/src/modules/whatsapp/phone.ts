/**
 * Meta Cloud API `to` is digits with country code and no plus.
 * Egyptian mobiles 01xxxxxxxxx are unambiguous. Anything else must already
 * include a country code. Ambiguous numbers are rejected, not guessed.
 */
export class WhatsAppPhoneError extends Error {
  constructor(message = 'Recipient phone number is invalid') {
    super(message);
    this.name = 'WhatsAppPhoneError';
  }
}

export function normalizeWhatsAppRecipient(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new WhatsAppPhoneError();
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`;
  else if (digits.startsWith('0')) throw new WhatsAppPhoneError();
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new WhatsAppPhoneError();
  return digits;
}

export function maskWhatsAppRecipient(digits: string): string {
  if (digits.length <= 4) return '****';
  return `${digits.slice(0, 3)}******${digits.slice(-3)}`;
}
