export type ItemPick = {
  id: string;
  code?: string | null;
  arabicName?: string | null;
  englishName?: string | null;
};

export function itemLabel(items: ItemPick[], itemId: string | undefined): string {
  if (!itemId) return '—';
  const it = items.find((i) => i.id === itemId);
  if (!it) return itemId;
  const code = it.code?.trim();
  const name = it.arabicName ?? it.englishName ?? '';
  if (code && name) return `${code} — ${name}`;
  return name || code || itemId;
}
