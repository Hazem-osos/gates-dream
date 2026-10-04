/**
 * Face of the statement of financial position per Egyptian Accounting Standard 1
 * (عرض القوائم المالية): current / non-current split, minimum line items, and a
 * note per line. Chart accounts are supporting detail, not the face.
 */

export type PositionRow = {
  code: string;
  arabicName: string;
  amount: number;
  depth: number;
};

export type LegalLineKind = 'header' | 'line' | 'total' | 'grand';

export type LegalFaceLine = {
  kind: LegalLineKind;
  name: string;
  note?: number;
  current?: number;
  opening?: number;
};

export type LegalNote = {
  note: number;
  title: string;
  opening: number;
  current: number;
  rows: { name: string; opening: number; current: number }[];
};

type Bucket =
  | 'ppe'
  | 'intangible'
  | 'investments'
  | 'otherNonCurrentAsset'
  | 'inventory'
  | 'receivables'
  | 'cash'
  | 'otherCurrentAsset'
  | 'capital'
  | 'reserves'
  | 'retained'
  | 'nonCurrentLiability'
  | 'payables'
  | 'otherCurrentLiability';

const FACE: Array<{ bucket: Bucket; title: string; section: string }> = [
  { bucket: 'ppe', title: 'أصول ثابتة', section: 'الأصول غير المتداولة' },
  { bucket: 'intangible', title: 'أصول غير ملموسة', section: 'الأصول غير المتداولة' },
  { bucket: 'investments', title: 'استثمارات', section: 'الأصول غير المتداولة' },
  { bucket: 'otherNonCurrentAsset', title: 'أصول غير متداولة أخرى', section: 'الأصول غير المتداولة' },
  { bucket: 'inventory', title: 'مخزون', section: 'الأصول المتداولة' },
  { bucket: 'receivables', title: 'عملاء وأرصدة مدينة أخرى', section: 'الأصول المتداولة' },
  { bucket: 'cash', title: 'نقدية وما في حكمها', section: 'الأصول المتداولة' },
  { bucket: 'otherCurrentAsset', title: 'أصول متداولة أخرى', section: 'الأصول المتداولة' },
  { bucket: 'capital', title: 'رأس المال', section: 'حقوق الملكية' },
  { bucket: 'reserves', title: 'احتياطيات', section: 'حقوق الملكية' },
  { bucket: 'retained', title: 'أرباح مرحلة', section: 'حقوق الملكية' },
  { bucket: 'nonCurrentLiability', title: 'التزامات غير متداولة', section: 'الالتزامات غير المتداولة' },
  { bucket: 'payables', title: 'موردون وأرصدة دائنة أخرى', section: 'الالتزامات المتداولة' },
  { bucket: 'otherCurrentLiability', title: 'التزامات متداولة أخرى', section: 'الالتزامات المتداولة' },
];

const SECTION_TOTAL: Record<string, string> = {
  'الأصول غير المتداولة': 'إجمالي الأصول غير المتداولة',
  'الأصول المتداولة': 'إجمالي الأصول المتداولة',
  'حقوق الملكية': 'إجمالي حقوق الملكية',
  'الالتزامات غير المتداولة': 'إجمالي الالتزامات غير المتداولة',
  'الالتزامات المتداولة': 'إجمالي الالتزامات المتداولة',
};

function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function leafRows(rows: PositionRow[]) {
  const leaves: Array<{ row: PositionRow; trail: string }> = [];
  const names: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    names[row.depth] = norm(row.arabicName);
    names.length = row.depth + 1;
    const next = rows[index + 1];
    if (next && next.depth > row.depth) continue;
    leaves.push({ row, trail: names.filter(Boolean).join(' ') });
  }
  return leaves;
}

function mentions(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function classifyPositionAccount(trail: string, side: 'asset' | 'credit'): Bucket {
  const text = norm(trail);
  const deferredTax = mentions(text, ['ضريبة مؤجلة', 'ضرائب مؤجلة']);
  const nonCurrentHint = mentions(text, ['غير متداول', 'طويلة الأجل', 'طويل الأجل', 'غير المتداولة']);
  const currentHint = mentions(text, ['متداول', 'قصيرة الأجل', 'قصير الأجل']);

  if (mentions(text, ['رأس المال العامل'])) {
    return side === 'asset' ? 'otherCurrentAsset' : 'otherCurrentLiability';
  }

  if (side === 'asset') {
    if (deferredTax) return 'otherNonCurrentAsset';
    if (mentions(text, ['غير ملموس', 'شهرة'])) return 'intangible';
    if (mentions(text, ['ثابت', 'أراضي', 'مبان', 'آلات', 'معدات', 'سيارات', 'أثاث', 'أصول ثابتة'])) return 'ppe';
    if (mentions(text, ['استثمار'])) return currentHint ? 'otherCurrentAsset' : 'investments';
    if (mentions(text, ['مخزون', 'بضاع', 'بضاعة'])) return 'inventory';
    if (mentions(text, ['نقد', 'خزين', 'بنك', 'صندوق', 'عهد'])) return 'cash';
    if (mentions(text, ['عميل', 'مدين', 'أوراق قبض', 'شيك', 'قبض'])) return 'receivables';
    if (nonCurrentHint && !currentHint) return 'otherNonCurrentAsset';
    return 'otherCurrentAsset';
  }

  if (
    mentions(text, ['رأس المال', 'رأس مال', 'حقوق', 'مساهم', 'احتياط', 'أرباح', 'خسائر', 'جاري الشركاء', 'جارى الشركاء']) &&
    !mentions(text, ['دائن', 'مورد', 'قرض', 'التزام'])
  ) {
    if (mentions(text, ['احتياط'])) return 'reserves';
    if (mentions(text, ['أرباح', 'خسائر', 'مرحلة'])) return 'retained';
    return 'capital';
  }
  if (deferredTax || (nonCurrentHint && !currentHint) || mentions(text, ['قرض طويل', 'مخصص نهاية'])) {
    return 'nonCurrentLiability';
  }
  if (mentions(text, ['مورد', 'دائن', 'أوراق دفع', 'شيك صرف'])) return 'payables';
  return 'otherCurrentLiability';
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildLegalFinancialPosition(
  assets: PositionRow[],
  credits: PositionRow[],
  openingOf: (row: PositionRow) => number
): { lines: LegalFaceLine[]; notes: LegalNote[] } {
  const buckets = new Map<Bucket, Array<{ name: string; current: number; opening: number }>>();
  const push = (bucket: Bucket, row: PositionRow) => {
    const current = row.amount;
    const opening = openingOf(row);
    if (current === 0 && opening === 0) return;
    const list = buckets.get(bucket) ?? [];
    list.push({
      name: row.code ? `${row.code} ${norm(row.arabicName)}` : norm(row.arabicName),
      current,
      opening,
    });
    buckets.set(bucket, list);
  };
  for (const leaf of leafRows(assets)) push(classifyPositionAccount(leaf.trail, 'asset'), leaf.row);
  for (const leaf of leafRows(credits)) push(classifyPositionAccount(leaf.trail, 'credit'), leaf.row);

  const lines: LegalFaceLine[] = [];
  const notes: LegalNote[] = [];
  let section = '';
  let sectionCurrent = 0;
  let sectionOpening = 0;
  let assetsCurrent = 0;
  let assetsOpening = 0;
  let equityCurrent = 0;
  let equityOpening = 0;
  let liabilitiesCurrent = 0;
  let liabilitiesOpening = 0;

  const closeSection = () => {
    if (!section) return;
    lines.push({
      kind: 'total',
      name: SECTION_TOTAL[section],
      current: round2(sectionCurrent),
      opening: round2(sectionOpening),
    });
    if (section.startsWith('الأصول')) {
      assetsCurrent += sectionCurrent;
      assetsOpening += sectionOpening;
    } else if (section === 'حقوق الملكية') {
      equityCurrent += sectionCurrent;
      equityOpening += sectionOpening;
    } else {
      liabilitiesCurrent += sectionCurrent;
      liabilitiesOpening += sectionOpening;
    }
    sectionCurrent = 0;
    sectionOpening = 0;
  };

  for (const item of FACE) {
    const rows = buckets.get(item.bucket) ?? [];
    if (!rows.length) continue;
    if (item.section !== section) {
      closeSection();
      if (section === 'الأصول المتداولة') {
        lines.push({
          kind: 'grand',
          name: 'إجمالي الأصول',
          current: round2(assetsCurrent),
          opening: round2(assetsOpening),
        });
      }
      section = item.section;
      lines.push({ kind: 'header', name: item.section });
    }
    const current = round2(rows.reduce((sum, row) => sum + row.current, 0));
    const opening = round2(rows.reduce((sum, row) => sum + row.opening, 0));
    const note = notes.length + 1;
    notes.push({ note, title: item.title, current, opening, rows });
    lines.push({ kind: 'line', name: item.title, note, current, opening });
    sectionCurrent += current;
    sectionOpening += opening;
  }
  closeSection();
  if (equityCurrent || liabilitiesCurrent || equityOpening || liabilitiesOpening) {
    lines.push({
      kind: 'grand',
      name: 'إجمالي الالتزامات وحقوق الملكية',
      current: round2(equityCurrent + liabilitiesCurrent),
      opening: round2(equityOpening + liabilitiesOpening),
    });
  }
  return { lines, notes };
}
