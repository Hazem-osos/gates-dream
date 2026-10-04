/** Gates POS tender codes mapped by default in ereceipt/payment-map (display only). */
export const GATES_PAYMENT_METHODS: { code: string; labelAr: string; defaultEta: string }[] = [
  { code: 'CASH', labelAr: 'نقدي', defaultEta: 'C' },
  { code: 'CARD', labelAr: 'بطاقة', defaultEta: 'V' },
  { code: 'VOUCHER', labelAr: 'قسيمة', defaultEta: 'VO' },
  { code: 'GIFT_CARD', labelAr: 'بطاقة هدايا', defaultEta: 'GC' },
  { code: 'POINTS', labelAr: 'نقاط', defaultEta: 'P' },
  { code: 'STORE_CREDIT', labelAr: 'رصيد متجر', defaultEta: 'O' },
  { code: 'WALLET', labelAr: 'محفظة', defaultEta: 'O' },
  { code: 'BANK', labelAr: 'بنك', defaultEta: 'O' },
  { code: 'CREDIT', labelAr: 'آجل', defaultEta: 'O' },
  { code: 'EXCHANGE', labelAr: 'مقايضة', defaultEta: 'O' },
  { code: 'DEPOSIT', labelAr: 'عربون', defaultEta: 'O' },
];

export const ETA_RECEIPT_PAYMENT_CODES: { code: string; labelAr: string }[] = [
  { code: 'C', labelAr: 'نقدي (C)' },
  { code: 'V', labelAr: 'بطاقة (V)' },
  { code: 'CC', labelAr: 'CC' },
  { code: 'VC', labelAr: 'VC' },
  { code: 'VO', labelAr: 'قسيمة (VO)' },
  { code: 'PR', labelAr: 'PR' },
  { code: 'GC', labelAr: 'بطاقة هدايا (GC)' },
  { code: 'P', labelAr: 'نقاط (P)' },
  { code: 'O', labelAr: 'أخرى (O)' },
];

export const RECEIPT_TYPE_LABELS_AR: Record<string, string> = {
  s: 'بيع (s)',
  r: 'مرتجع (r)',
  RWR: 'مرتجع بدون مرجع (RWR)',
  SR: 'بيع تجزئة (SR)',
  SC: 'مطاعم وقهى (SC)',
  SS: 'خدمات عامة (SS)',
  ST: 'نقل (ST)',
  SH: 'شحن (SH)',
  SP: 'مهن حرة (SP)',
  SB: 'بنوك (SB)',
  SE: 'تعليم (SE)',
  SN: 'ترفيه (SN)',
  SU: 'مرافق (SU)',
  RR: 'مرتجع تجزئة (RR)',
  RC: 'مرتجع مطاعم (RC)',
  RS: 'مرتجع خدمات (RS)',
  RT: 'مرتجع نقل (RT)',
  RH: 'مرتجع شحن (RH)',
  RP: 'مرتجع مهن (RP)',
  RB: 'مرتجع بنوك (RB)',
  RE: 'مرتجع تعليم (RE)',
  RN: 'مرتجع ترفيه (RN)',
  RU: 'مرتجع مرافق (RU)',
};

export function parseStringArrayJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => String(row)).filter(Boolean);
}

export function parsePaymentMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim()) out[key] = val.trim();
  }
  return out;
}

export function deviceRowReady(device: {
  active: boolean;
  deviceSerialNumber: string;
  branchCode: string;
  posOsVersion: string;
  posModelFramework: string;
  activityCode?: string | null;
  clientId: string;
  clientSecretConfigured?: boolean;
  presharedKeyConfigured?: boolean;
}): boolean {
  return (
    device.active &&
    Boolean(device.deviceSerialNumber?.trim()) &&
    Boolean(device.branchCode?.trim()) &&
    Boolean(device.posOsVersion?.trim()) &&
    Boolean(device.posModelFramework?.trim()) &&
    Boolean(device.activityCode?.trim()) &&
    Boolean(device.clientId?.trim()) &&
    Boolean(device.clientSecretConfigured) &&
    Boolean(device.presharedKeyConfigured)
  );
}
