export type CurrencyCatalogItem = {
  code: string;
  symbol: string;
  arabicName: string;
  englishName: string;
};

export const CURRENCY_CATALOG: CurrencyCatalogItem[] = [
  { code: 'EGP', symbol: 'ج.م', arabicName: 'جنيه مصري', englishName: 'Egyptian Pound' },
  { code: 'USD', symbol: '$', arabicName: 'دولار أمريكي', englishName: 'US Dollar' },
  { code: 'EUR', symbol: '€', arabicName: 'يورو', englishName: 'Euro' },
  { code: 'GBP', symbol: '£', arabicName: 'جنيه إسترليني', englishName: 'British Pound' },
  { code: 'SAR', symbol: 'ر.س', arabicName: 'ريال سعودي', englishName: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', arabicName: 'درهم إماراتي', englishName: 'UAE Dirham' },
  { code: 'KWD', symbol: 'د.ك', arabicName: 'دينار كويتي', englishName: 'Kuwaiti Dinar' },
  { code: 'QAR', symbol: 'ر.ق', arabicName: 'ريال قطري', englishName: 'Qatari Riyal' },
  { code: 'BHD', symbol: 'د.ب', arabicName: 'دينار بحريني', englishName: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'ر.ع', arabicName: 'ريال عماني', englishName: 'Omani Rial' },
  { code: 'JOD', symbol: 'د.أ', arabicName: 'دينار أردني', englishName: 'Jordanian Dinar' },
  { code: 'CHF', symbol: 'CHF', arabicName: 'فرنك سويسري', englishName: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', arabicName: 'ين ياباني', englishName: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', arabicName: 'يوان صيني', englishName: 'Chinese Yuan' },
  { code: 'TRY', symbol: '₺', arabicName: 'ليرة تركية', englishName: 'Turkish Lira' },
];

export function findCurrencyCatalog(codeOrSymbol: string): CurrencyCatalogItem | undefined {
  const value = codeOrSymbol.trim();
  return CURRENCY_CATALOG.find(
    (item) => item.code === value.toUpperCase() || item.symbol === value
  );
}
