const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const ALEF_VARIANTS = /[أإآ]/g;

/** Normalize Arabic text for client-side search (matches worker index). */
export function normalizeArabicForSearch(input: string): string {
  return input
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
    .toLowerCase();
}

export function normalizeSearchBlob(parts: (string | null | undefined)[]): string {
  return normalizeArabicForSearch(parts.filter(Boolean).join(' '));
}
