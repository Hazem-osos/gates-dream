export type ClipboardItemRef = {
  id: string;
  arabicName: string;
  englishName?: string | null;
  code?: string | null;
  serial?: string | null;
};

export type ParsedClipboardLine = {
  itemId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  rawName: string;
};

export function parseTabDelimitedRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t').map((c) => c.trim()));
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchItemFromToken(items: ClipboardItemRef[], token: string): ClipboardItemRef | undefined {
  const t = normalizeToken(token);
  if (!t) return undefined;
  const exact =
    items.find((i) => normalizeToken(i.serial ?? '') === t) ||
    items.find((i) => normalizeToken(i.code ?? '') === t) ||
    items.find((i) => normalizeToken(i.arabicName) === t) ||
    items.find((i) => normalizeToken(i.englishName ?? '') === t);
  if (exact) return exact;
  return items.find(
    (i) =>
      normalizeToken(i.arabicName).includes(t) ||
      t.includes(normalizeToken(i.arabicName)) ||
      (i.englishName && normalizeToken(i.englishName).includes(t))
  );
}

export function parseInvoiceLinesFromClipboard(
  text: string,
  items: ClipboardItemRef[]
): { lines: ParsedClipboardLine[]; skipped: number } {
  const rows = parseTabDelimitedRows(text);
  const lines: ParsedClipboardLine[] = [];
  let skipped = 0;
  for (const cols of rows) {
    const nameCol = cols[0] ?? '';
    const item = matchItemFromToken(items, nameCol);
    if (!item) {
      skipped += 1;
      continue;
    }
    const qty = Number(cols[1]?.replace(/,/g, '') ?? 1);
    const price = cols[2] != null && cols[2] !== '' ? Number(cols[2].replace(/,/g, '')) : 0;
    const discount = cols[3] != null && cols[3] !== '' ? Number(cols[3].replace(/,/g, '')) : 0;
    lines.push({
      itemId: item.id,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unitPrice: Number.isFinite(price) ? price : 0,
      discount: Number.isFinite(discount) ? discount : 0,
      rawName: nameCol,
    });
  }
  return { lines, skipped };
}
