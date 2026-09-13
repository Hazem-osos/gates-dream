/** Normalize Egyptian mobile numbers to wa.me digits (no +). */
export function normalizeEgyptPhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('20') && d.length >= 12) {
    return isEgyptianMobileWaDigits(d) ? d : null;
  }
  if (d.startsWith('0') && d.length === 11) {
    const intl = `20${d.slice(1)}`;
    return isEgyptianMobileWaDigits(intl) ? intl : null;
  }
  if (d.length === 10 && d.startsWith('1')) {
    const intl = `20${d}`;
    return isEgyptianMobileWaDigits(intl) ? intl : null;
  }
  if (d.length >= 11 && d.startsWith('20')) {
    return isEgyptianMobileWaDigits(d) ? d : null;
  }
  return null;
}

/** Egyptian mobile in international form without + (201xxxxxxxxx). */
function isEgyptianMobileWaDigits(d: string): boolean {
  return /^20(10|11|12|15)\d{8}$/.test(d);
}

export function openWhatsAppChat(phoneDigits: string | null | undefined, message: string) {
  const base = phoneDigits?.trim() ? `https://wa.me/${phoneDigits}` : 'https://wa.me/';
  const url = `${base}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
