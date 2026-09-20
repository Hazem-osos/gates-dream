/** Arabic amount in words (EGP) — فقط ولا غير */

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const onesFem = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const teens = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

function twoDigits(n: number, feminine: boolean): string {
  if (n === 0) return '';
  if (n < 10) return (feminine ? onesFem : ones)[n];
  if (n < 20) return teens[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (o === 0) return tens[t];
  return `${(feminine ? onesFem : ones)[o]} و${tens[t]}`;
}

function threeDigits(n: number, feminine: boolean): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let head = '';
  if (h === 1) head = 'مائة';
  else if (h === 2) head = 'مائتان';
  else if (h > 2) head = `${ones[h]} مائة`;
  const tail = twoDigits(rest, feminine);
  if (!head) return tail;
  if (!tail) return head;
  return `${head} و${tail}`;
}

function scaleChunk(n: number, singular: string, dual: string, plural: string, feminine: boolean): string {
  if (n === 0) return '';
  if (n === 1) return singular;
  if (n === 2) return dual;
  if (n >= 3 && n <= 10) return `${threeDigits(n, feminine)} ${plural}`;
  return `${threeDigits(n, feminine)} ${singular}`;
}

function integerToArabicWords(n: number): string {
  if (n === 0) return 'صفر';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const hundreds = n % 1000;

  if (millions) {
    parts.push(scaleChunk(millions, 'مليون', 'مليونان', 'ملايين', false));
  }
  if (thousands) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10)
      parts.push(`${threeDigits(thousands, true)} آلاف`);
    else parts.push(`${threeDigits(thousands, false)} ألف`);
  }
  if (hundreds) {
    parts.push(threeDigits(hundreds, false));
  }
  return parts.filter(Boolean).join(' و');
}

export function tafqeetEgp(amount: number): string {
  return tafqeetAmount(amount, 'EGP');
}

export function tafqeetAmount(amount: number, currencyCode?: string | null): string {
  const safe = Math.max(0, Number(amount) || 0);
  const major = Math.floor(safe);
  const minor = Math.round((safe - major) * 100);
  const majorText = integerToArabicWords(major);
  const code = (currencyCode || 'EGP').trim().toUpperCase();
  const unitName = currencyUnitName(code);
  if (minor === 0) {
    return `فقط وقدره ${majorText} ${unitName} لا غير`;
  }
  const minorText = integerToArabicWords(minor);
  const fractionName = code === 'EGP' ? 'قرشاً' : 'من المائة';
  return `فقط وقدره ${majorText} ${unitName} و${minorText} ${fractionName} لا غير`;
}

function currencyUnitName(code: string): string {
  if (code === 'EGP') return 'جنيه مصري';
  const names: Record<string, string> = {
    USD: 'دولار أمريكي',
    EUR: 'يورو',
    GBP: 'جنيه إسترليني',
    SAR: 'ريال سعودي',
    AED: 'درهم إماراتي',
    KWD: 'دينار كويتي',
    QAR: 'ريال قطري',
    BHD: 'دينار بحريني',
    OMR: 'ريال عماني',
    JOD: 'دينار أردني',
    CHF: 'فرنك سويسري',
    JPY: 'ين ياباني',
    CNY: 'يوان صيني',
    TRY: 'ليرة تركية',
  };
  return names[code] || code;
}
