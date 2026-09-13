import { normalizeEgyptPhoneForWhatsApp } from '@/lib/whatsapp/egyptPhone';

export type PartyPhoneFields = {
  mobile?: string | null;
  phone1?: string | null;
  phone2?: string | null;
};

/** First customer/supplier phone that normalizes to a valid Egyptian mobile for wa.me. */
export function resolvePartyWhatsAppPhone(
  party: PartyPhoneFields | null | undefined
): string | null {
  if (!party) return null;
  for (const raw of [party.mobile, party.phone1, party.phone2]) {
    const normalized = normalizeEgyptPhoneForWhatsApp(raw);
    if (normalized) return normalized;
  }
  return null;
}
