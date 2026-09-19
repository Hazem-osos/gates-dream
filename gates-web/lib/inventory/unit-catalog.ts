export type UnitCatalogItem = {
  code: string;
  arabicName: string;
  englishName: string;
};

export const UNIT_CATALOG: UnitCatalogItem[] = [
  { code: 'PCS', arabicName: 'قطعة', englishName: 'Piece' },
  { code: 'DOZ', arabicName: 'دستة', englishName: 'Dozen' },
  { code: 'PAIR', arabicName: 'زوج', englishName: 'Pair' },
  { code: 'SET', arabicName: 'طقم', englishName: 'Set' },
  { code: 'BOX', arabicName: 'صندوق', englishName: 'Box' },
  { code: 'CTN', arabicName: 'كرتونة', englishName: 'Carton' },
  { code: 'PACK', arabicName: 'باكت', englishName: 'Pack' },
  { code: 'BAG', arabicName: 'كيس', englishName: 'Bag' },
  { code: 'ROLL', arabicName: 'رول', englishName: 'Roll' },
  { code: 'KG', arabicName: 'كيلوجرام', englishName: 'Kilogram' },
  { code: 'G', arabicName: 'جرام', englishName: 'Gram' },
  { code: 'TON', arabicName: 'طن', englishName: 'Ton' },
  { code: 'L', arabicName: 'لتر', englishName: 'Liter' },
  { code: 'ML', arabicName: 'ملليلتر', englishName: 'Milliliter' },
  { code: 'M', arabicName: 'متر', englishName: 'Meter' },
  { code: 'CM', arabicName: 'سنتيمتر', englishName: 'Centimeter' },
  { code: 'M2', arabicName: 'متر مربع', englishName: 'Square meter' },
  { code: 'M3', arabicName: 'متر مكعب', englishName: 'Cubic meter' },
  { code: 'HR', arabicName: 'ساعة', englishName: 'Hour' },
  { code: 'DAY', arabicName: 'يوم', englishName: 'Day' },
];

export function findUnitCatalog(codeOrName: string): UnitCatalogItem | undefined {
  const value = codeOrName.trim().toUpperCase();
  const raw = codeOrName.trim();
  return UNIT_CATALOG.find(
    (item) =>
      item.code === value ||
      item.arabicName === raw ||
      item.englishName.toUpperCase() === value
  );
}

export function formatUnitOptionLabel(unit: {
  code?: string | null;
  arabicName?: string | null;
}): string {
  const name = unit.arabicName?.trim() || unit.code || 'وحدة';
  return unit.code ? `${name} (${unit.code})` : name;
}
